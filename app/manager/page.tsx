"use client"

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/manager/header";
import OrdersGrid from "@/components/manager/orders-grid";
import { PickedUpOrdersSheet } from "@/components/manager/picked-up-orders-sheet";
import { StationCard } from "@/components/manager/StationCard";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

function getWorkdayBounds() {
    const now = new Date();
    const currentHour = now.getHours();
    const start = new Date(now);
    if (currentHour < 7) start.setDate(start.getDate() - 1);
    start.setHours(7, 0, 0, 0);
    return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
}

const toOrder = (o: Order): Order => ({
    id: o.id,
    ticketNumber: o.ticketNumber,
    displayCode: o.displayCode,
    status: o.status,
    confirmedAt: o.confirmedAt,
    completedAt: o.completedAt,
    ordersStations: o.ordersStations,
    orderStationStates: o.orderStationStates,
});

export default function Manager() {
    const { t } = useTranslation();

    // --- Normal mode state ---
    const [confirmedOrders, setConfirmedOrders] = useState<Order[]>([]);
    const [readyOrders, setReadyOrders] = useState<Order[]>([]);
    const [pickedUpOrders, setPickedUpOrders] = useState<Order[]>([]);

    // --- Stations mode state ---
    const [stations, setStations] = useState<Station[]>([]);
    const [stationsEnabled, setStationsEnabled] = useState(false);
    const stationsEnabledRef = useRef(false);
    // sub-order confirmed per station (being prepared)
    const [stationConfirmed, setStationConfirmed] = useState<Record<string, Order[]>>({});
    // sub-order completed per station (station done, waiting pickup)
    const [stationCompleted, setStationCompleted] = useState<Record<string, Order[]>>({});

    // Keeps a ref to stations list so SSE closures can access it
    const stationsRef = useRef<Station[]>([]);
    useEffect(() => { stationsRef.current = stations; }, [stations]);

    const fetchAllPages = async (baseParams: string): Promise<Order[]> => {
        let page = 1;
        let all: Order[] = [];
        let hasNextPage = true;
        while (hasNextPage) {
            const res = await fetch(`/api/orders?limit=100&page=${page}${baseParams}`);
            if (!res.ok) break;
            const json = await res.json();
            const batch: Order[] = json.data || json.orders || (Array.isArray(json) ? json : []);
            if (Array.isArray(batch)) all = [...all, ...batch.map(toOrder)];
            hasNextPage = (json.pagination?.currentPage ?? 0) < (json.pagination?.totalPages ?? 0);
            page++;
        }
        return all;
    };

    const fetchOrders = useCallback(async () => {
        try {
            const { dateFrom, dateTo } = getWorkdayBounds();
            const dateParams = `&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;

            if (stationsEnabledRef.current) {
                const stList = stationsRef.current;
                const orders = await fetchAllPages(`${dateParams}&include=ordersStationsStates`);

                const confirmedMap: Record<string, Order[]> = {};
                const completedMap: Record<string, Order[]> = {};
                const pickedUp: Order[] = [];
                for (const s of stList) { confirmedMap[s.id] = []; completedMap[s.id] = []; }

                for (const o of orders) {
                    if (o.status === 'PICKED_UP') {
                        pickedUp.push(o);
                    } else {
                        for (const state of o.orderStationStates ?? []) {
                            if (state.status === 'CONFIRMED' && state.stationId in confirmedMap && !confirmedMap[state.stationId].find(x => x.id === o.id)) {
                                confirmedMap[state.stationId].push(o);
                            } else if (state.status === 'COMPLETED' && state.stationId in completedMap && !completedMap[state.stationId].find(x => x.id === o.id)) {
                                completedMap[state.stationId].push(o);
                            }
                        }
                    }
                }
                setStationConfirmed(confirmedMap);
                setStationCompleted(completedMap);
                setPickedUpOrders(pickedUp);
                return;
            }

            const orders = await fetchAllPages(dateParams);
            const confirmed: Order[] = [];
            const ready: Order[] = [];
            const pickedUp: Order[] = [];
            for (const o of orders) {
                if (o.status === 'CONFIRMED') confirmed.push(o);
                else if (o.status === 'COMPLETED') ready.push(o);
                else if (o.status === 'PICKED_UP') pickedUp.push(o);
            }
            setConfirmedOrders(confirmed);
            setReadyOrders(ready);
            setPickedUpOrders(pickedUp);
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        }
    }, []);

    // Fetch display config + stations on mount
    useEffect(() => {
        fetch("/api/display-config")
            .then(res => res.ok ? res.json() : null)
            .then(cfg => {
                if (cfg?.stationsEnabled) {
                    stationsEnabledRef.current = true;
                    setStationsEnabled(true);
                    return fetch("/api/stations");
                }
                return null;
            })
            .then(res => res && res.ok ? res.json() : null)
            .then(data => {
                if (Array.isArray(data)) {
                    stationsRef.current = data;
                    setStations(data);
                    const empty: Record<string, Order[]> = {};
                    for (const s of data) empty[s.id] = [];
                    setStationConfirmed({ ...empty });
                    setStationCompleted({ ...empty });
                    fetchOrders();
                }
            })
            .catch(console.error);
    }, []);

    // SSE setup
    useEffect(() => {
        fetchOrders();

        const eventSource = new EventSource('/api/events/display');
        eventSource.onopen = () => { fetchOrders(); };

        const removeFromAllStations = (orderId: string) => {
            setStationConfirmed(prev => {
                const next = { ...prev };
                for (const k of Object.keys(next)) next[k] = next[k].filter(o => o.id !== orderId);
                return next;
            });
            setStationCompleted(prev => {
                const next = { ...prev };
                for (const k of Object.keys(next)) next[k] = next[k].filter(o => o.id !== orderId);
                return next;
            });
        };

        const handleConfirmedOrder = (event: MessageEvent) => {
            try {
                const newOrder = toOrder(JSON.parse(event.data));
                if (stationsEnabledRef.current) {
                    setStationConfirmed(prev => {
                        const next = { ...prev };
                        for (const stId of newOrder.ordersStations ?? []) {
                            if (stId in next && !next[stId].find(o => o.id === newOrder.id)) {
                                next[stId] = [...next[stId], newOrder];
                            }
                        }
                        return next;
                    });
                    return;
                }
                setConfirmedOrders(prev => {
                    if (prev.find(o => String(o.id) === String(newOrder.id))) return prev;
                    return [...prev, newOrder];
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

                if (stationsEnabledRef.current) {
                    if (updated.status === 'PICKED_UP') {
                        removeFromAllStations(sid);
                        setPickedUpOrders(prev => prev.find(o => o.id === sid) ? prev : [...prev, updated]);
                    } else if (updated.status === 'CONFIRMED') {
                        // Undo: back to station confirmed for all its stations
                        removeFromAllStations(sid);
                        setStationConfirmed(prev => {
                            const next = { ...prev };
                            for (const stId of updated.ordersStations ?? []) {
                                if (stId in next && !next[stId].find(o => o.id === sid)) {
                                    next[stId] = [...next[stId], updated];
                                }
                            }
                            return next;
                        });
                    }
                    // COMPLETED (overall): sub-orders already handled optimistically per station
                    return;
                }

                setConfirmedOrders(prev => prev.filter(o => String(o.id) !== sid));
                setReadyOrders(prev => prev.filter(o => String(o.id) !== sid));
                setPickedUpOrders(prev => prev.filter(o => String(o.id) !== sid));
                if (updated.status === 'CONFIRMED') setConfirmedOrders(prev => [...prev, updated]);
                if (updated.status === 'COMPLETED') setReadyOrders(prev => [...prev, updated]);
                if (updated.status === 'PICKED_UP') setPickedUpOrders(prev => [...prev, updated]);
            } catch (err) {
                console.error("Error parsing order-status-update event:", err);
            }
        });

        eventSource.addEventListener('order-cancelled', (event: MessageEvent) => {
            try {
                const cancelled = JSON.parse(event.data);
                const sid = String(cancelled.id);
                if (stationsEnabledRef.current) {
                    removeFromAllStations(sid);
                    setPickedUpOrders(prev => prev.filter(o => String(o.id) !== sid));
                } else {
                    setConfirmedOrders(prev => prev.filter(o => String(o.id) !== sid));
                    setReadyOrders(prev => prev.filter(o => String(o.id) !== sid));
                    setPickedUpOrders(prev => prev.filter(o => String(o.id) !== sid));
                }
                toast.warning(t("manager.orderCancelled", { code: cancelled.displayCode }));
            } catch (err) {
                console.error("Error parsing order-cancelled event:", err);
            }
        });

        eventSource.onerror = () => { console.error("SSE connection error"); };

        return () => { eventSource.close(); };
    }, [fetchOrders]);

    const updateOrderStatus = async (orderId: string, newStatus: Status, stationId?: string) => {
        try {
            const endpoint = stationId
                ? `/api/orders/${orderId}/stations/${stationId}`
                : `/api/orders/${orderId}`;
            const res = await fetch(endpoint, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) { fetchOrders(); }
        } catch { fetchOrders(); }
    };

    // --- Station mode handlers ---
    const handleStationMarkDone = (order: Order, stationId: string) => {
        setStationConfirmed(prev => ({ ...prev, [stationId]: prev[stationId]?.filter(o => o.id !== order.id) ?? [] }));
        setStationCompleted(prev => ({ ...prev, [stationId]: [...(prev[stationId] ?? []), order] }));
        updateOrderStatus(order.id, 'COMPLETED', stationId);
    };

    const handleStationMarkUndo = (order: Order, stationId: string) => {
        setStationCompleted(prev => ({ ...prev, [stationId]: prev[stationId]?.filter(o => o.id !== order.id) ?? [] }));
        setStationConfirmed(prev => ({ ...prev, [stationId]: [...(prev[stationId] ?? []), order] }));
        updateOrderStatus(order.id, 'CONFIRMED', stationId);
    };

    const handleStationMarkPickup = (order: Order, stationId: string) => {
        setStationCompleted(prev => {
            const next = { ...prev };
            for (const k of Object.keys(next)) next[k] = next[k].filter(o => o.id !== order.id);
            return next;
        });
        setPickedUpOrders(prev => [...prev, order]);
        updateOrderStatus(order.id, 'PICKED_UP', stationId);
    };

    const handlePickupToCompleteStation = (order: Order) => {
        setPickedUpOrders(prev => prev.filter(o => o.id !== order.id));
        setStationCompleted(prev => {
            const next = { ...prev };
            for (const stId of order.ordersStations ?? []) {
                if (stId in next && !next[stId].find(o => o.id === order.id)) {
                    next[stId] = [...next[stId], order];
                }
            }
            return next;
        });
        updateOrderStatus(order.id, 'COMPLETED');
    };

    // --- Normal mode handlers ---
    const handleConfirmToComplete = (order: Order) => {
        setConfirmedOrders(prev => prev.filter(o => o.id !== order.id));
        setReadyOrders(prev => [...prev, order]);
        updateOrderStatus(order.id, 'COMPLETED');
    };

    const handleCompleteToConfirm = (order: Order) => {
        setReadyOrders(prev => prev.filter(o => o.id !== order.id));
        setConfirmedOrders(prev => [...prev, order]);
        updateOrderStatus(order.id, 'CONFIRMED');
    };

    const handleCompleteToPickup = (order: Order) => {
        setReadyOrders(prev => prev.filter(o => o.id !== order.id));
        setPickedUpOrders(prev => [...prev, order]);
        updateOrderStatus(order.id, 'PICKED_UP');
    };

    const handlePickupToComplete = (order: Order) => {
        setPickedUpOrders(prev => prev.filter(o => o.id !== order.id));
        setReadyOrders(prev => [...prev, order]);
        updateOrderStatus(order.id, 'COMPLETED');
    };

    // --- Stations layout ---
    if (stationsEnabled && stations.length > 0) {
        return (
            <div className="h-screen w-full flex flex-col overflow-hidden">
                <Header pickedUpOrders={pickedUpOrders} onPickupPrev={handlePickupToCompleteStation} />
                <main className="flex-1 w-full overflow-hidden">
                    <div className="h-full w-full flex gap-3 p-3 pt-20 md:pt-24 max-w-[1920px] mx-auto overflow-x-auto">
                        {stations.map(station => (
                            <StationCard
                                key={station.id}
                                className="flex-1 min-w-60"
                                stationName={station.name}
                                confirmedOrders={stationConfirmed[station.id] ?? []}
                                completedOrders={stationCompleted[station.id] ?? []}
                                pickedUpOrders={pickedUpOrders.filter(o =>
                                    o.orderStationStates?.some(s => s.stationId === station.id) ??
                                    o.ordersStations?.includes(station.id)
                                )}
                                onConfirmedNext={order => handleStationMarkDone(order, station.id)}
                                onCompletedPrev={order => handleStationMarkUndo(order, station.id)}
                                onCompletedNext={order => handleStationMarkPickup(order, station.id)}
                                onPickupPrev={handlePickupToCompleteStation}
                            />
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    // --- Normal layout ---
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
    );
}
