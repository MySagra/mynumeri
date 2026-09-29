"use client"

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/manager/header";
import { StationCard } from "@/components/manager/StationCard";
import { EmptyStations } from "@/components/empty-stations";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch, handleApiError } from "@/lib/api";
import { subscribeSSE } from "@/lib/sse";
import { resolveOrderEventType, statusForOrderEvent } from "@/lib/order-events";
import { withMinimumDelay } from "@/lib/minimum-delay";

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
    const router = useRouter();

    // Single source of truth: all orders keyed by id
    const [ordersMap, setOrdersMap] = useState<Map<string, Order>>(new Map());

    // Station config
    const [stations, setStations] = useState<Station[]>([]);
    const [stationsLoaded, setStationsLoaded] = useState(false);
    const [refreshingStations, setRefreshingStations] = useState(false);
    // --- Orders grouped by station ---
    const stationConfirmed = useMemo(() => {
        const map: Record<string, Order[]> = {};
        for (const s of stations) map[s.id] = [];
        for (const o of ordersMap.values())
            for (const state of o.orderStationStates ?? [])
                if (state.status === 'CONFIRMED' && state.stationId in map &&
                    !map[state.stationId].find(x => x.id === o.id))
                    map[state.stationId].push(o);
        return map;
    }, [ordersMap, stations]);

    const stationCompleted = useMemo(() => {
        const map: Record<string, Order[]> = {};
        for (const s of stations) map[s.id] = [];
        for (const o of ordersMap.values())
            for (const state of o.orderStationStates ?? [])
                if (state.status === 'COMPLETED' && state.stationId in map &&
                    !map[state.stationId].find(x => x.id === o.id))
                    map[state.stationId].push(o);
        return map;
    }, [ordersMap, stations]);

    const stationPickedUp = useMemo(() => {
        const map: Record<string, Order[]> = {};
        for (const s of stations) map[s.id] = [];
        for (const o of ordersMap.values())
            for (const state of o.orderStationStates ?? [])
                if (state.status === 'PICKED_UP' && state.stationId in map &&
                    !map[state.stationId].find(x => x.id === o.id))
                    map[state.stationId].push(o);
        return map;
    }, [ordersMap, stations]);

    // Flat deduped picked-up list for the header in station mode
    const pickedUpOrders = useMemo(() => {
        const seen = new Set<string>();
        const result: Order[] = [];
        for (const list of Object.values(stationPickedUp))
            for (const o of list)
                if (!seen.has(o.id)) { seen.add(o.id); result.push(o); }
        return result;
    }, [stationPickedUp]);

    const fetchAllPages = async (baseParams: string): Promise<Order[]> => {
        let page = 1;
        let all: Order[] = [];
        let hasNextPage = true;
        while (hasNextPage) {
            const json = await apiFetch<{ data?: Order[]; orders?: Order[]; pagination?: { currentPage?: number; totalPages?: number } }>(`/api/orders?limit=100&page=${page}${baseParams}`);
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
            const orders = await fetchAllPages(`${dateParams}&include=ordersStationsStates`);
            setOrdersMap(new Map(orders.filter(o => (o.orderStationStates ?? []).length > 0).map(o => [o.id, o])));
        } catch (error) {
            if (handleApiError(error, router)) return;
            console.error("Failed to fetch orders:", error);
        }
    }, [router]);

    const fetchStations = useCallback(async () => {
        setRefreshingStations(true);
        try {
            const data = await withMinimumDelay(apiFetch<Station[]>("/api/stations"), 200);
            if (Array.isArray(data)) {
                setStations(data);
                setStationsLoaded(true);
                if (data.length > 0) await fetchOrders();
            }
        } catch (err) {
            if (!handleApiError(err, router)) console.error("Failed to fetch stations:", err);
        } finally {
            setRefreshingStations(false);
        }
    }, [fetchOrders, router]);

    useEffect(() => { void fetchStations(); }, [fetchStations]);

    // SSE setup
    useEffect(() => {
        fetchOrders();

        const handleConfirmedOrder = (data: unknown, _frame?: unknown, type = 'confirmed-order') => {
            try {
                const raw = toOrder(data as Order);
                if (!(raw.ordersStations?.length || raw.orderStationStates?.length)) return;
                // Il payload dell'evento non porta `status`: lo si deduce dal tipo evento
                const status = raw.status ?? statusForOrderEvent(type) ?? 'CONFIRMED';
                // Il payload SSE può contenere solo gli ID delle postazioni.
                const orderStationStates = (raw.orderStationStates ?? []).length > 0
                    ? raw.orderStationStates!
                    : (raw.ordersStations ?? []).map(stId => ({ stationId: stId, status }));
                setOrdersMap(prev => new Map(prev).set(raw.id, { ...raw, status, orderStationStates }));
            } catch (err) {
                console.error("Error handling confirmed-order event:", err);
            }
        };

        const close = subscribeSSE('/api/events/display', {
            // Il tipo evento arriva da `event:`, dal campo `type` del payload o,
            // in ultima istanza, viene dedotto dalla forma del JSON.
            resolveType: resolveOrderEventType,
            // Refetch full state on every reconnect to resync after any missed events
            onOpen: ({ reconnect }) => { if (reconnect) fetchOrders(); },
            onError: () => { console.error("SSE connection error"); },
            // Evento senza tipo riconoscibile: trattato come confirmed-order (comportamento storico)
            onMessage: handleConfirmedOrder,
            on: {
                'confirmed-order': handleConfirmedOrder,

                'order-status-update': (data) => {
                    try {
                        const { id, status, displayCode, ticketNumber } = data as Order;
                        setOrdersMap(prev => {
                            const existing = prev.get(String(id));
                            if (!existing) return prev;

                            let orderStationStates = existing.orderStationStates;
                            // The header undo PATCH targets the whole order.
                            if (status === 'COMPLETED') {
                                orderStationStates = (orderStationStates ?? []).map(s =>
                                    s.status === 'PICKED_UP' ? { ...s, status: 'COMPLETED' } : s
                                );
                            } else if (status === 'CONFIRMED') {
                                orderStationStates = (orderStationStates ?? []).map(s =>
                                    s.status === 'COMPLETED' ? { ...s, status: 'CONFIRMED' } : s
                                );
                            }

                            return new Map(prev).set(String(id), {
                                ...existing,
                                status,
                                displayCode,
                                ticketNumber,
                                orderStationStates,
                            });
                        });
                    } catch (err) {
                        console.error("Error handling order-status-update event:", err);
                    }
                },

                'order-station-status-update': (data) => {
                    try {
                        const { orderId, stationId, status } = data as { orderId: string; stationId: string; status: Status };
                        setOrdersMap(prev => {
                            const order = prev.get(String(orderId));
                            if (!order) return prev;
                            const existing = order.orderStationStates ?? [];
                            const hasState = existing.some(s => s.stationId === stationId);
                            const updatedStates = hasState
                                ? existing.map(s => s.stationId === stationId ? { ...s, status } : s)
                                : [...existing, { stationId, status }];
                            return new Map(prev).set(order.id, { ...order, orderStationStates: updatedStates });
                        });
                    } catch (err) {
                        console.error("Error handling order-station-status-update event:", err);
                    }
                },

                'order-cancelled': (data) => {
                    try {
                        const cancelled = data as Order;
                        const sid = String(cancelled.id);
                        setOrdersMap(prev => { const next = new Map(prev); next.delete(sid); return next; });
                        toast.warning(t("manager.orderCancelled", { code: cancelled.displayCode }));
                    } catch (err) {
                        console.error("Error handling order-cancelled event:", err);
                    }
                },
            },
        });

        return () => { close(); };
    }, [fetchOrders, t]);

    const updateOrderStatus = async (orderId: string, newStatus: Status, stationId?: string) => {
        try {
            const endpoint = stationId
                ? `/api/orders/${orderId}/stations/${stationId}`
                : `/api/orders/${orderId}`;
            await apiFetch(endpoint, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
        } catch (error) {
            if (handleApiError(error, router)) return;
            fetchOrders();
        }
    };

    // --- Station handlers ---
    const handleStationMarkDone = (order: Order, stationId: string) => {
        setOrdersMap(prev => {
            const current = prev.get(order.id) ?? order;
            const updatedStates = (current.orderStationStates ?? []).map(s =>
                s.stationId === stationId ? { ...s, status: 'COMPLETED' } : s
            );
            return new Map(prev).set(order.id, { ...current, orderStationStates: updatedStates });
        });
        updateOrderStatus(order.id, 'COMPLETED', stationId);
    };

    const handleStationMarkUndo = (order: Order, stationId: string) => {
        setOrdersMap(prev => {
            const current = prev.get(order.id) ?? order;
            const updatedStates = (current.orderStationStates ?? []).map(s =>
                s.stationId === stationId ? { ...s, status: 'CONFIRMED' } : s
            );
            return new Map(prev).set(order.id, { ...current, orderStationStates: updatedStates });
        });
        updateOrderStatus(order.id, 'CONFIRMED', stationId);
    };

    const handleStationMarkPickup = (order: Order, stationId: string) => {
        setOrdersMap(prev => {
            const current = prev.get(order.id) ?? order;
            const updatedStates = (current.orderStationStates ?? []).map(s =>
                s.stationId === stationId ? { ...s, status: 'PICKED_UP' } : s
            );
            return new Map(prev).set(order.id, { ...current, orderStationStates: updatedStates });
        });
        updateOrderStatus(order.id, 'PICKED_UP', stationId);
    };

    const handlePickupToCompleteStation = (order: Order, stationId?: string) => {
        setOrdersMap(prev => {
            const current = prev.get(order.id) ?? order;
            // With stationId: move that specific station PICKED_UP → COMPLETED
            // Without stationId (header): move all PICKED_UP stations → COMPLETED
            const updatedStates = stationId
                ? (current.orderStationStates ?? []).map(s =>
                    s.stationId === stationId ? { ...s, status: 'COMPLETED' } : s
                )
                : (current.orderStationStates ?? []).map(s =>
                    s.status === 'PICKED_UP' ? { ...s, status: 'COMPLETED' } : s
                );
            return new Map(prev).set(order.id, { ...current, orderStationStates: updatedStates });
        });
        updateOrderStatus(order.id, 'COMPLETED', stationId);
    };

    return (
        <div className="h-screen w-full flex flex-col overflow-hidden">
            <Header pickedUpOrders={pickedUpOrders} onPickupPrev={handlePickupToCompleteStation} />
            <main className="flex-1 w-full overflow-hidden">
                {stationsLoaded && stations.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 pt-16">
                        <EmptyStations onRefresh={() => { void fetchStations(); }} refreshing={refreshingStations} />
                    </div>
                ) : (
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
                )}
            </main>
        </div>
    );
}
