"use client"

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/manager/header";
import OrdersGrid from "@/components/manager/orders-grid";
import { PickedUpOrdersSheet } from "@/components/manager/picked-up-orders-sheet";
import { useTranslation } from "react-i18next";

function getWorkdayBounds() {
    const now = new Date();
    const currentHour = now.getHours();

    const start = new Date(now);
    if (currentHour < 8) {
        // Before 8 AM, it belongs to the previous day's shift
        start.setDate(start.getDate() - 1);
    }
    start.setHours(8, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(7, 59, 59, 999);

    return {
        dateFrom: start.toISOString(),
        dateTo: end.toISOString()
    };
}

const sortByTicket = (a: Order, b: Order) => a.ticketNumber - b.ticketNumber;

const toOrder = (o: Order): Order => ({
    id: o.id,
    ticketNumber: o.ticketNumber,
    displayCode: o.displayCode,
    status: o.status,
});

export default function Manager() {
    const { t } = useTranslation();
    const [confirmedOrders, setConfirmedOrders] = useState<Order[]>([]);
    const [readyOrders, setReadyOrders] = useState<Order[]>([]);
    const [pickedUpOrders, setPickedUpOrders] = useState<Order[]>([]);

    const fetchOrders = useCallback(async () => {
        try {
            const { dateFrom, dateTo } = getWorkdayBounds();
            const dateParams = `&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;

            const res = await fetch(`/api/orders?limit=100${dateParams}`);
            if (res.ok) {
                const json = await res.json();
                const raw: Order[] = json.data || json.orders || json || [];
                const list = Array.isArray(raw) ? raw.map(toOrder) : [];

                setConfirmedOrders(list.filter(o => o.status === "CONFIRMED").sort(sortByTicket));
                setReadyOrders(list.filter(o => o.status === "COMPLETED").sort(sortByTicket));
                setPickedUpOrders(list.filter(o => o.status === "PICKED_UP").sort(sortByTicket));
            }
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        }
    }, []);

    useEffect(() => {
        // Fetch initially when page loads
        fetchOrders();

        // Then setup SSE EventSource
        const eventSource = new EventSource('/api/events/display');

        eventSource.onopen = () => {
            console.log("SSE connected");
            fetchOrders();
        };

        const handleConfirmedOrder = (event: MessageEvent) => {
            try {
                const newOrder = toOrder(JSON.parse(event.data));
                setConfirmedOrders(prev => {
                    if (prev.find(o => String(o.id) === String(newOrder.id))) return prev;
                    return [...prev, newOrder].sort(sortByTicket);
                });
            } catch (err) {
                console.error("Error parsing confirmed-order event:", err);
            }
        };

        eventSource.addEventListener('confirmed-order', handleConfirmedOrder);
        eventSource.onmessage = handleConfirmedOrder;

        eventSource.addEventListener('order-status-update', (event: MessageEvent) => {
            try {
                const updated: Order = toOrder(JSON.parse(event.data));
                const sid = String(updated.id);
                setConfirmedOrders(prev => prev.filter(o => String(o.id) !== sid));
                setReadyOrders(prev => prev.filter(o => String(o.id) !== sid));
                setPickedUpOrders(prev => prev.filter(o => String(o.id) !== sid));
                if (updated.status === 'CONFIRMED') setConfirmedOrders(prev => [...prev, updated].sort(sortByTicket));
                if (updated.status === 'COMPLETED') setReadyOrders(prev => [...prev, updated].sort(sortByTicket));
                if (updated.status === 'PICKED_UP') setPickedUpOrders(prev => [...prev, updated].sort(sortByTicket));
            } catch (err) {
                console.error("Error parsing order-status-update event:", err);
            }
        });

        eventSource.onerror = (error) => {
            console.error("SSE connection error:", error);
            // Auto reconnect via standard EventSource logic
        };

        return () => {
            eventSource.close();
        };
    }, [fetchOrders]); // ensure this doesn't run infinitely

    const updateOrderStatus = async (orderId: string, newStatus: Status) => {
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
                console.error("Failed to update status");
                fetchOrders();
            }
        } catch (error) {
            console.error(error);
            fetchOrders();
        }
    };

    const handleConfirmToComplete = (order: Order) => {
        setConfirmedOrders(prev => prev.filter(o => o.id !== order.id));
        setReadyOrders(prev => [...prev, order].sort(sortByTicket));
        updateOrderStatus(order.id, 'COMPLETED');
    };

    const handleCompleteToConfirm = (order: Order) => {
        setReadyOrders(prev => prev.filter(o => o.id !== order.id));
        setConfirmedOrders(prev => [...prev, order].sort(sortByTicket));
        updateOrderStatus(order.id, 'CONFIRMED');
    };

    const handleCompleteToPickup = (order: Order) => {
        setReadyOrders(prev => prev.filter(o => o.id !== order.id));
        setPickedUpOrders(prev => [...prev, order].sort(sortByTicket));
        updateOrderStatus(order.id, 'PICKED_UP');
    };

    const handlePickupToComplete = (order: Order) => {
        setPickedUpOrders(prev => prev.filter(o => o.id !== order.id));
        setReadyOrders(prev => [...prev, order].sort(sortByTicket));
        updateOrderStatus(order.id, 'COMPLETED');
    };

    return (
        <div className="h-screen w-full flex flex-col overflow-hidden">
            <Header pickedUpOrders={pickedUpOrders} onPickupPrev={handlePickupToComplete} />
            <main className="flex-1 w-full overflow-hidden">
                <div className="h-full w-full flex flex-col md:grid md:grid-cols-3 gap-3 p-3 pt-20 md:pt-24 max-w-[1920px] mx-auto">
                    <OrdersGrid
                        status="CONFIRMED"
                        className="flex-1 min-h-0 min-w-0 md:flex-none md:col-span-2 md:h-full"
                        orders={confirmedOrders}
                        title={t("manager.preparingOrders")}
                        onNext={handleConfirmToComplete}
                    />
                    <OrdersGrid
                        status="COMPLETED"
                        className="flex-1 min-h-0 min-w-0 md:flex-none md:col-span-1 md:h-full"
                        orders={readyOrders}
                        title={t("manager.readyOrders")}
                        onPrev={handleCompleteToConfirm}
                        onNext={handleCompleteToPickup}
                    >
                        <div className="hidden md:block">
                            <PickedUpOrdersSheet
                                pickedUpOrders={pickedUpOrders}
                                onPrev={handlePickupToComplete}
                            />
                        </div>
                    </OrdersGrid>
                </div>
            </main>
        </div>
    )
}
