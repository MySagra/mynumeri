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
import { applySagraSettings, loadSagraSettings, SETTINGS_UPDATE_EVENT } from "@/lib/sagra-settings";
import { getShiftStart } from "@/utils/utils";
import { applyDisplayUpdate, loadDisplays, useSelectedDisplay, DISPLAY_UPDATE_EVENT } from "@/lib/displays";
import { DisplayPicker } from "@/components/display-picker";

async function getWorkdayBounds() {
    // Il turno si calcola nella timezone della sagra (impostazioni centralizzate).
    const settings = await loadSagraSettings();
    const start = getShiftStart(7, settings?.timezone);
    return { dateFrom: start.toISOString(), dateTo: new Date().toISOString() };
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
    // Monitor scelto su questo dispositivo: il manager gestisce solo le sue postazioni
    const { display, ready: displaysReady } = useSelectedDisplay("manager");
    const [pickingDisplay, setPickingDisplay] = useState(false);
    const [allStations, setAllStations] = useState<Station[]>([]);
    const stations = useMemo(() => {
        if (!display) return [];
        const byId = new Map(allStations.map(s => [s.id, s]));
        return display.stationIds.map(id => byId.get(id)).filter((s): s is Station => !!s);
    }, [allStations, display]);
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

    // Fetch puri (nessun setState): l'applicazione del risultato è separata, così gli
    // effect possono applicarlo in un callback asincrono.
    const loadOrders = useCallback(async (): Promise<Order[] | null> => {
        try {
            const { dateFrom, dateTo } = await getWorkdayBounds();
            const dateParams = `&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;
            return await fetchAllPages(`${dateParams}&include=ordersStationsStates`);
        } catch (error) {
            if (!handleApiError(error, router)) console.error("Failed to fetch orders:", error);
            return null;
        }
    }, [router]);

    const applyOrders = (orders: Order[]) => {
        setOrdersMap(new Map(orders.filter(o => (o.orderStationStates ?? []).length > 0).map(o => [o.id, o])));
    };

    const fetchOrders = useCallback(async () => {
        const orders = await loadOrders();
        if (orders) applyOrders(orders);
    }, [loadOrders]);

    const loadStations = useCallback(async (): Promise<Station[] | null> => {
        try {
            const data = await withMinimumDelay(apiFetch<Station[]>("/api/stations"), 200);
            return Array.isArray(data) ? data : null;
        } catch (err) {
            if (!handleApiError(err, router)) console.error("Failed to fetch stations:", err);
            return null;
        }
    }, [router]);

    const applyStations = useCallback(async (data: Station[]) => {
        setAllStations(data);
        setStationsLoaded(true);
        if (data.length > 0) await fetchOrders();
    }, [fetchOrders]);

    // Ricarica manuale (pulsante): mostra lo spinner, a differenza del caricamento iniziale
    const refreshStations = async () => {
        setRefreshingStations(true);
        try {
            const data = await loadStations();
            if (data) await applyStations(data);
        } finally {
            setRefreshingStations(false);
        }
    };

    useEffect(() => {
        let active = true;
        void loadStations().then(data => { if (active && data) void applyStations(data); });
        return () => { active = false; };
    }, [loadStations, applyStations]);

    // SSE setup
    useEffect(() => {
        let active = true;
        void loadOrders().then(orders => { if (active && orders) applyOrders(orders); });

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
            onOpen: ({ reconnect }) => {
                if (!reconnect) return;
                void loadSagraSettings(true);
                void loadDisplays(true);
                fetchOrders();
            },
            onError: () => { console.error("SSE connection error"); },
            // Evento senza tipo riconoscibile: trattato come confirmed-order (comportamento storico)
            onMessage: handleConfirmedOrder,
            on: {
                [SETTINGS_UPDATE_EVENT]: (data) => { applySagraSettings(data); },
                [DISPLAY_UPDATE_EVENT]: (data) => { applyDisplayUpdate(data); },

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

        return () => { active = false; close(); };
    }, [fetchOrders, loadOrders, t]);

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
            <Header
                pickedUpOrders={pickedUpOrders}
                onPickupPrev={handlePickupToCompleteStation}
                display={display}
                onChangeDisplay={() => setPickingDisplay(true)}
            />
            <main className="flex-1 w-full overflow-hidden">
                {!displaysReady ? null : !display || pickingDisplay ? (
                    <div className="flex h-full items-start justify-center overflow-auto px-4 pb-4 pt-24">
                        <DisplayPicker
                            scope="manager"
                            onClose={display ? () => setPickingDisplay(false) : undefined}
                        />
                    </div>
                ) : stationsLoaded && stations.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 pt-16">
                        <EmptyStations onRefresh={() => { void refreshStations(); }} refreshing={refreshingStations} />
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
