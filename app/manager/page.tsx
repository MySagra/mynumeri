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
    const [stationConfirmed, setStationConfirmed] = useState<Record<string, Order[]>>({});
    const [stationCompleted, setStationCompleted] = useState<Record<string, Order[]>>({});
    const [stationPickedUp, setStationPickedUp] = useState<Record<string, Order[]>>({});

    // Keeps a ref to stations list so SSE closures can access it
    const stationsRef = useRef<Station[]>([]);
    useEffect(() => { stationsRef.current = stations; }, [stations]);

    // Refs to current station maps so SSE closures can look up orders by id
    const stationConfirmedRef = useRef<Record<string, Order[]>>({});
    const stationCompletedRef = useRef<Record<string, Order[]>>({});
    const pickedUpOrdersRef = useRef<Order[]>([]);
    useEffect(() => { stationConfirmedRef.current = stationConfirmed; }, [stationConfirmed]);
    useEffect(() => { stationCompletedRef.current = stationCompleted; }, [stationCompleted]);
    useEffect(() => { pickedUpOrdersRef.current = pickedUpOrders; }, [pickedUpOrders]);

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

            // Always fetch with station states included
            const orders = await fetchAllPages(`${dateParams}&include=ordersStationsStates`);

            if (stationsEnabledRef.current) {
                const stList = stationsRef.current;
                const confirmedMap: Record<string, Order[]> = {};
                const completedMap: Record<string, Order[]> = {};
                const pickedUpMap: Record<string, Order[]> = {};
                for (const s of stList) { confirmedMap[s.id] = []; completedMap[s.id] = []; pickedUpMap[s.id] = []; }

                for (const o of orders) {
                    // Distribute by station-level status (independent of order-level status)
                    for (const state of o.orderStationStates ?? []) {
                        const stId = state.stationId;
                        if (state.status === 'CONFIRMED' && stId in confirmedMap && !confirmedMap[stId].find(x => x.id === o.id)) {
                            confirmedMap[stId].push(o);
                        } else if (state.status === 'COMPLETED' && stId in completedMap && !completedMap[stId].find(x => x.id === o.id)) {
                            completedMap[stId].push(o);
                        } else if (state.status === 'PICKED_UP' && stId in pickedUpMap && !pickedUpMap[stId].find(x => x.id === o.id)) {
                            pickedUpMap[stId].push(o);
                        }
                    }
                }

                // Flatten pickedUpMap → flat pickedUpOrders for header (deduped)
                const pickedUpSeen = new Set<string>();
                const pickedUp: Order[] = [];
                for (const list of Object.values(pickedUpMap)) {
                    for (const o of list) {
                        if (!pickedUpSeen.has(o.id)) { pickedUpSeen.add(o.id); pickedUp.push(o); }
                    }
                }

                setStationConfirmed(confirmedMap);
                setStationCompleted(completedMap);
                setStationPickedUp(pickedUpMap);
                setPickedUpOrders(pickedUp);
                return;
            }

            // Normal mode: skip orders with no station assignments
            const confirmed: Order[] = [];
            const ready: Order[] = [];
            const pickedUp: Order[] = [];
            for (const o of orders) {
                if ((o.orderStationStates ?? []).length === 0) continue;
                if (o.status === 'CONFIRMED' || o.status === 'PARTIAL') confirmed.push(o);
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
                // Ignore orders not assigned to any station
                if ((newOrder.ordersStations ?? []).length === 0) return;
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
                const raw = JSON.parse(event.data);
                const { id, status } = raw;
                const sid = String(id);

                if (stationsEnabledRef.current) {
                    // Find order in current maps before clearing (refs still point to current state)
                    let order: Order | undefined;
                    for (const stId of Object.keys(stationConfirmedRef.current)) {
                        order = stationConfirmedRef.current[stId].find(o => String(o.id) === sid);
                        if (order) break;
                    }
                    if (!order) {
                        for (const stId of Object.keys(stationCompletedRef.current)) {
                            order = stationCompletedRef.current[stId].find(o => String(o.id) === sid);
                            if (order) break;
                        }
                    }
                    if (!order) {
                        order = pickedUpOrdersRef.current.find(o => String(o.id) === sid);
                    }

                    removeFromAllStations(sid);

                    if (status === 'CONFIRMED' && order) {
                        // Undo: put back in confirmed for every station the order belongs to
                        const stIds = Object.keys(stationCompletedRef.current).filter(k =>
                            stationCompletedRef.current[k].some(o => String(o.id) === sid) ||
                            stationConfirmedRef.current[k]?.some(o => String(o.id) === sid)
                        );
                        setStationConfirmed(prev => {
                            const next = { ...prev };
                            for (const stId of stIds) {
                                if (stId in next && !next[stId].find(o => String(o.id) === sid)) next[stId] = [...next[stId], order!];
                            }
                            return next;
                        });
                    } else if (status === 'COMPLETED' && order) {
                        const stIdsFromConfirmed = Object.keys(stationConfirmedRef.current).filter(k =>
                            stationConfirmedRef.current[k].some(o => String(o.id) === sid)
                        );
                        // fallback: use order.ordersStations when coming from PICKED_UP
                        const stIds = stIdsFromConfirmed.length > 0
                            ? stIdsFromConfirmed
                            : (order.ordersStations ?? []).filter(k => k in stationCompletedRef.current);
                        setPickedUpOrders(prev => prev.filter(o => String(o.id) !== sid));
                        setStationCompleted(prev => {
                            const next = { ...prev };
                            for (const stId of stIds) {
                                if (stId in next && !next[stId].find(o => String(o.id) === sid)) next[stId] = [...next[stId], order!];
                            }
                            return next;
                        });
                    } else if (status === 'PICKED_UP' && order) {
                        setPickedUpOrders(prev => prev.find(o => String(o.id) === sid) ? prev : [...prev, order!]);
                    }
                    return;
                }

                const updated = toOrder(raw);
                setConfirmedOrders(prev => prev.filter(o => String(o.id) !== sid));
                setReadyOrders(prev => prev.filter(o => String(o.id) !== sid));
                setPickedUpOrders(prev => prev.filter(o => String(o.id) !== sid));
                if (updated.status === 'CONFIRMED' || updated.status === 'PARTIAL') setConfirmedOrders(prev => [...prev, updated]);
                if (updated.status === 'COMPLETED') setReadyOrders(prev => [...prev, updated]);
                if (updated.status === 'PICKED_UP') setPickedUpOrders(prev => [...prev, updated]);
            } catch (err) {
                console.error("Error parsing order-status-update event:", err);
            }
        });

        eventSource.addEventListener('order-station-status-update', (event: MessageEvent) => {
            if (!stationsEnabledRef.current) return;
            try {
                const { orderId, stationId, status } = JSON.parse(event.data);
                const sid = String(orderId);

                if (status === 'COMPLETED') {
                    const order = stationConfirmedRef.current[stationId]?.find(o => String(o.id) === sid)
                               ?? pickedUpOrdersRef.current.find(o => String(o.id) === sid);
                    setStationConfirmed(prev => ({ ...prev, [stationId]: (prev[stationId] ?? []).filter(o => String(o.id) !== sid) }));
                    setStationPickedUp(prev => ({ ...prev, [stationId]: (prev[stationId] ?? []).filter(o => String(o.id) !== sid) }));
                    setPickedUpOrders(prev => prev.filter(o => String(o.id) !== sid));
                    if (order) setStationCompleted(prev => prev[stationId]?.find(o => String(o.id) === sid) ? prev : { ...prev, [stationId]: [...(prev[stationId] ?? []), order] });
                } else if (status === 'CONFIRMED') {
                    const order = stationCompletedRef.current[stationId]?.find(o => String(o.id) === sid)
                               ?? stationConfirmedRef.current[stationId]?.find(o => String(o.id) === sid);
                    setStationCompleted(prev => ({ ...prev, [stationId]: (prev[stationId] ?? []).filter(o => String(o.id) !== sid) }));
                    if (order) setStationConfirmed(prev => prev[stationId]?.find(o => String(o.id) === sid) ? prev : { ...prev, [stationId]: [...(prev[stationId] ?? []), order] });
                } else if (status === 'PICKED_UP') {
                    const order = stationCompletedRef.current[stationId]?.find(o => String(o.id) === sid)
                               ?? stationConfirmedRef.current[stationId]?.find(o => String(o.id) === sid);
                    setStationConfirmed(prev => ({ ...prev, [stationId]: (prev[stationId] ?? []).filter(o => String(o.id) !== sid) }));
                    setStationCompleted(prev => ({ ...prev, [stationId]: (prev[stationId] ?? []).filter(o => String(o.id) !== sid) }));
                    if (order) {
                        setStationPickedUp(prev => prev[stationId]?.find(o => String(o.id) === sid) ? prev : { ...prev, [stationId]: [...(prev[stationId] ?? []), order] });
                        setPickedUpOrders(prev => prev.find(o => String(o.id) === sid) ? prev : [...prev, order]);
                    }
                }
            } catch (err) {
                console.error("Error parsing order-station-status-update event:", err);
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
        setStationCompleted(prev => ({ ...prev, [stationId]: prev[stationId]?.filter(o => o.id !== order.id) ?? [] }));
        setStationPickedUp(prev => ({
            ...prev,
            [stationId]: prev[stationId]?.find(o => o.id === order.id) ? prev[stationId] : [...(prev[stationId] ?? []), order],
        }));
        setPickedUpOrders(prev => prev.find(o => o.id === order.id) ? prev : [...prev, order]);
        updateOrderStatus(order.id, 'PICKED_UP', stationId);
    };

    const handlePickupToCompleteStation = (order: Order, stationId?: string) => {
        setPickedUpOrders(prev => prev.filter(o => o.id !== order.id));
        if (stationId) {
            setStationPickedUp(prev => ({ ...prev, [stationId]: prev[stationId]?.filter(o => o.id !== order.id) ?? [] }));
            setStationCompleted(prev => ({
                ...prev,
                [stationId]: prev[stationId]?.find(o => o.id === order.id) ? prev[stationId] : [...(prev[stationId] ?? []), order],
            }));
        }
        updateOrderStatus(order.id, 'COMPLETED', stationId);
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
                                stationId={station.id}
                                stationName={station.name}
                                confirmedOrders={stationConfirmed[station.id] ?? []}
                                completedOrders={stationCompleted[station.id] ?? []}
                                pickedUpOrders={stationPickedUp[station.id] ?? []}
                                onConfirmedNext={order => handleStationMarkDone(order, station.id)}
                                onCompletedPrev={order => handleStationMarkUndo(order, station.id)}
                                onCompletedNext={order => handleStationMarkPickup(order, station.id)}
                                onPickupPrev={order => handlePickupToCompleteStation(order, station.id)}
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
