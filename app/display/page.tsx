"use client";

import { Header } from "@/components/display/header";
import OrdersGrid from "@/components/display/orders-grid";
import { useEffect, useState } from "react";
import { getWorkdayBounds, sortByDate } from "@/utils/utils";
import { useCallback } from "react";

interface readyOrder {
    id: string,
    status: "PENDING" | "CONFIRMED" | "COMPLETED" | "PICKED_UP"
    ticketNumber: number,
    displayCode: string
}

export default function Display() {
    const [readyOrders, setReadyOrders] = useState<readyOrder[]>([]);
    const [removingIds, setRemovingIds] = useState<string[]>([]);

    const fetchOrders = useCallback(async () => {
        try {
            const { dateFrom, dateTo } = getWorkdayBounds();
            const dateParams = `&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;

            // Fetch COMPLETED 
            const resComp = await fetch(`/api/orders?status=COMPLETED&limit=100${dateParams}`);
            if (resComp.ok) {
                const json = await resComp.json();
                console.log("Ready Data:", json)
                const orders: Order[] = json.data || json.orders || json || [];
                const projected = Array.isArray(orders)
                    ? orders
                        .sort(sortByDate)
                        .map(({ id, ticketNumber, displayCode, status }) => ({ id, ticketNumber, displayCode, status }))
                    : [];
                setReadyOrders(projected);
            }
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        }
    }, []);

    useEffect(() => {
        fetchOrders()
            .then(() => console.log(readyOrders))

        let isConnected = false;
        const eventSource = new EventSource('/api/events/display');

        eventSource.onopen = () => {
            console.log("SSE connected");
            isConnected = true;
            fetchOrders();
        };

        eventSource.addEventListener('order-status-update', (event: MessageEvent) => {
            const data = JSON.parse(event.data) as readyOrder;

            if (data.status === "COMPLETED") {
                setRemovingIds(prev => prev.filter(id => id !== String(data.id)));
                setReadyOrders(prev => {
                    if (prev.find(order => String(order.id) === String(data.id))) return prev;
                    return [...prev, data];
                });
            } else {
                const removeId = String(data.id);
                setRemovingIds(prev => (prev.includes(removeId) ? prev : [...prev, removeId]));
                setTimeout(() => {
                    setReadyOrders(prev => prev.filter(order => String(order.id) !== removeId));
                    setRemovingIds(prev => prev.filter(id => id !== removeId));
                }, 200);
            }
            console.log(data);
        });


    }, [fetchOrders])

    return (
        <>
            <Header />
            <main className="h-screen w-full flex bg-gray-100 pt-20 p-5 mx-auto">
                <div className="grid grid-cols-4 grid-rows-4 md:grid-cols-12 md:grid-rows-12 w-full gap-1.5">
                    {
                        readyOrders.map(readyOrder =>
                            <div
                                className={`order-card p-3 bg-accent shadow-md rounded-sm font-semibold flex items-center place-content-center${removingIds.includes(String(readyOrder.id)) ? " order-card--exit" : ""}`}
                                key={readyOrder.id}
                            >
                                <p className="text-3xl">
                                    {readyOrder.displayCode}
                                </p>

                            </div>
                        )
                    }
                </div>
            </main>
        </>
    )
}