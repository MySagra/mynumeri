"use client";

import { Header } from "@/components/display/header";
import { EmptyStations } from "@/components/empty-stations";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getWorkdayBounds, sortByDate } from "@/utils/utils";
import { type DisplayMode, DISPLAY_MODE_KEY } from "@/components/settings/DisplayModeSettingsCard";
import { EVENT_NAME_KEY } from "@/components/settings/GeneralSettingsCard";
import { DISPLAY_ZOOM_KEY } from "@/components/settings/DisplayZoomSettingsCard";
import type { DisplayConfig } from "@/lib/display-config-store";
import { useTranslation } from "react-i18next";
import { apiFetch, handleApiError } from "@/lib/api";
import { subscribeSSE } from "@/lib/sse";
import { resolveOrderEventType, statusForOrderEvent } from "@/lib/order-events";
import { withMinimumDelay } from "@/lib/minimum-delay";
import { useAnimatedOrders } from "@/hooks/use-animated-orders";

const PAGE_INTERVAL = 10000;

// Stations display constants
const STATION_COLS = 2;
const STATION_ROWS = 4;
const STATION_HYBRID_ROWS = 2;

const MAX_STATIONS_FOR_HYBRID = 3;

interface ReadyOrder {
    id: string;
    status: "PENDING" | "CONFIRMED" | "COMPLETED" | "PICKED_UP" | "PARTIAL";
    ticketNumber: number;
    displayCode: string;
    ordersStations?: string[];
    orderStationStates?: OrderStationState[];
    _alertStationId?: string;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({ announcement }: { announcement: string }) {
    const { t } = useTranslation();
    const measureRef = useRef<HTMLSpanElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldScroll, setShouldScroll] = useState(false);
    const [duration, setDuration] = useState(20);

    useEffect(() => {
        const measure = () => {
            if (!measureRef.current || !containerRef.current) return;
            const textW = measureRef.current.scrollWidth;
            const containerW = containerRef.current.clientWidth;
            const overflows = textW > containerW;
            setShouldScroll(overflows);
            if (overflows) setDuration(Math.max(12, textW / 100));
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [announcement]);

    if (!announcement) return null;

    return (
        <footer className="flex-shrink-0 bg-amber-400 border-t-2 border-amber-500 flex items-center overflow-hidden" style={{ height: "68px" }}>
            <span className="flex-shrink-0 ml-12 mr-6 px-4 py-1 rounded-full bg-black text-amber-400 text-sm font-black uppercase tracking-widest select-none">
                {t("display.notice")}
            </span>
            <span className="flex-shrink-0 w-px h-8 bg-black/20 mr-6" />
            <div ref={containerRef} className="flex-1 overflow-hidden">
                <span ref={measureRef} className="fixed invisible whitespace-nowrap pointer-events-none" aria-hidden="true" style={{ fontSize: "1.25rem" }}>
                    {announcement}
                </span>
                {shouldScroll ? (
                    <div className="flex whitespace-nowrap" style={{ animation: `marquee-scroll ${duration}s linear infinite` }}>
                        <span className="text-xl font-semibold text-black pr-40">{announcement}</span>
                        <span className="text-xl font-semibold text-black pr-40">{announcement}</span>
                    </div>
                ) : (
                    <span className="text-xl font-semibold text-black whitespace-nowrap">{announcement}</span>
                )}
            </div>
            <span className="flex-shrink-0 w-12" />
        </footer>
    );
}

// ---------------------------------------------------------------------------
// OrderCard
// ---------------------------------------------------------------------------

function OrderCard({ order, getOrderLabel, cardBgClass = "bg-white" }: {
    order: ReadyOrder;
    getOrderLabel: (order: ReadyOrder) => string;
    cardBgClass?: string;
}) {
    return (
        <div className={`h-full ${cardBgClass} border-2 border-gray-200 rounded-2xl flex items-center justify-center shadow-sm p-3`} style={{ containerType: "size" }}>
            <p className="font-black font-mono text-black select-none leading-none" style={{ fontSize: "min(50cqw, 90cqh)" }}>
                {getOrderLabel(order)}
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// DisplaySection
// ---------------------------------------------------------------------------

interface DisplaySectionProps {
    orders: ReadyOrder[];
    cols: number;
    rows: number;
    title: string;
    headerClass: string;
    cardBgClass: string;
    sectionId: string;
    immediateRemoval?: boolean;
    getOrderLabel: (order: ReadyOrder) => string;
    bare?: boolean;
    autoScrollEnabled?: boolean;
    displayZoom?: number;
}

function DisplaySection({ orders, cols, rows, title, headerClass, cardBgClass, sectionId, immediateRemoval = false, getOrderLabel, bare = false, autoScrollEnabled = true, displayZoom = 100 }: DisplaySectionProps) {
    const staticCardsPerPage = cols * rows;
    const [effectiveCardsPerPage, setEffectiveCardsPerPage] = useState(staticCardsPerPage);
    const cardsPerPage = effectiveCardsPerPage;
    const [currentPage, setCurrentPage] = useState(0);
    const [displayedOrders, setDisplayedOrders] = useState<(ReadyOrder | null)[]>(orders);
    const latestRef = useRef<ReadyOrder[]>(orders);
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => { latestRef.current = orders; }, [orders]);

    // Compute actual grid capacity from container size — CSS uses auto-fill so visual
    // slots depend on container dimensions, not cols*rows props.
    useEffect(() => {
        const el = gridRef.current;
        if (!el) return;
        const compute = () => {
            const { width, height } = el.getBoundingClientRect();
            if (width < 10 || height < 10) return;
            const gap = 12; // gap-3 = 12px
            const minColW = 100 * displayZoom / 100; // minmax(100px, 1fr) scaled by zoom
            const minRowH = 70 * displayZoom / 100;  // minmax(70px, 1fr) scaled by zoom
            const c = Math.max(1, Math.floor((width + gap) / (minColW + gap)));
            const r = Math.max(1, Math.floor((height + gap) / (minRowH + gap)));
            setEffectiveCardsPerPage(c * r);
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [displayZoom]);

    const realOrderCount = displayedOrders.filter((o): o is ReadyOrder => o !== null).length;
    const totalPages = Math.max(1, Math.ceil(realOrderCount / cardsPerPage));

    useEffect(() => {
        setDisplayedOrders(prev => {
            const prevItems = prev.filter((o): o is ReadyOrder => o !== null);
            if (prevItems.length <= cardsPerPage) return orders;
            const currentIds = new Set(orders.map(o => o.id));
            const prevIds = new Set(prevItems.map(o => o.id));
            const newOrders = orders.filter(o => !prevIds.has(o.id));
            if (immediateRemoval) {
                const base = prevItems.filter(o => currentIds.has(o.id));
                if (newOrders.length === 0 && base.length === prevItems.length) return prev;
                return [...base, ...newOrders];
            }
            // Replace removed orders with null — blank slot, preserves position
            const base = prev.map(o => (o === null || currentIds.has(o.id)) ? o : null);
            if (newOrders.length === 0 && base.every((o, i) => o === prev[i])) return prev;
            return [...base, ...newOrders];
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orders, cardsPerPage, immediateRemoval]);

    useEffect(() => {
        if (!autoScrollEnabled) { setCurrentPage(0); return; }
        if (totalPages <= 1) { setCurrentPage(0); return; }
        const timer = setTimeout(() => {
            setCurrentPage(prev => {
                const next = prev + 1;
                if (next >= totalPages) { setDisplayedOrders([...latestRef.current]); return 0; }
                return next;
            });
        }, PAGE_INTERVAL);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, totalPages, autoScrollEnabled]);

    const pageOrders = displayedOrders.slice(currentPage * cardsPerPage, (currentPage + 1) * cardsPerPage);
    const animatedOrders = useAnimatedOrders(pageOrders, String(currentPage));

    const inner = (
        <>
            <div className={`flex-shrink-0 flex items-center justify-between px-5 ${headerClass}`} style={{ minHeight: "48px" }}>
                <h3 className={`font-bold text-black select-none tracking-tight ${bare ? "text-lg" : "text-3xl font-black"}`}>{title}</h3>
                {autoScrollEnabled && totalPages > 1 && (
                    <div className="flex items-center gap-1 bg-black/10 rounded-lg px-3 py-1">
                        <span className="text-black font-black text-base select-none tabular-nums leading-none">{currentPage + 1}</span>
                        <span className="text-black/50 font-bold text-sm select-none leading-none">/</span>
                        <span className="text-black font-black text-base select-none tabular-nums leading-none">{totalPages}</span>
                    </div>
                )}
            </div>
            {autoScrollEnabled && (
                <div className="h-1.5 w-full bg-black/10 shrink-0">
                    {totalPages > 1 && (
                        <div key={`${sectionId}-${currentPage}`} className="h-full bg-black/70 rounded-r-full origin-left" style={{ animation: `progress-bar-fill ${PAGE_INTERVAL}ms linear forwards` }} />
                    )}
                </div>
            )}
            <div className="flex-1 p-4 overflow-hidden">
                <div ref={gridRef} className="h-full grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${100 * displayZoom / 100}px, 1fr))`, gridTemplateRows: `repeat(auto-fill, minmax(${70 * displayZoom / 100}px, 1fr))` }}>
                    {animatedOrders.map(({ key, order, exiting }) => order ? (
                        <div key={key} className={exiting ? "order-card--exit" : "order-card"} aria-hidden={exiting}>
                            <OrderCard order={order} getOrderLabel={getOrderLabel} cardBgClass={cardBgClass} />
                        </div>
                    ) : (
                        <div key={key} />
                    ))}
                </div>
            </div>
        </>
    );

    if (bare) return <div className="flex flex-col h-full">{inner}</div>;
    return <div className="flex flex-col h-full rounded-xl overflow-hidden border-2 border-gray-200 bg-white shadow-sm">{inner}</div>;
}

// ---------------------------------------------------------------------------
// SplitDisplaySection — one card split top/bottom for hybrid stations mode
// ---------------------------------------------------------------------------

interface SplitDisplaySectionProps {
    stationName: string;
    topOrders: ReadyOrder[];
    bottomOrders: ReadyOrder[];
    topTitle: string;
    bottomTitle: string;
    topHeaderClass: string;
    bottomHeaderClass: string;
    topCardBgClass: string;
    bottomCardBgClass: string;
    sectionId: string;
    cols: number;
    topRows: number;
    bottomRows: number;
    getOrderLabel: (order: ReadyOrder) => string;
    autoScrollEnabled?: boolean;
    displayZoom?: number;
}

function SplitDisplaySection({
    stationName,
    topOrders, bottomOrders,
    topTitle, bottomTitle,
    topHeaderClass, bottomHeaderClass,
    topCardBgClass, bottomCardBgClass,
    sectionId, cols, topRows, bottomRows, getOrderLabel,
    autoScrollEnabled = true,
    displayZoom = 100,
}: SplitDisplaySectionProps) {
    return (
        <div className="flex flex-col h-full rounded-xl overflow-hidden border-2 border-gray-200 bg-white shadow-sm">
            {/* Station name header */}
            <div className="shrink-0 flex items-center px-5 bg-white" style={{ minHeight: "56px" }}>
                <h2 className="text-2xl font-black text-black select-none tracking-tight">{stationName}</h2>
            </div>
            {/* Top 1/3: preparing */}
            <div className="min-h-0 flex flex-col overflow-hidden border-t border-gray-200" style={{ flex: 1 }}>
                <DisplaySection
                    orders={topOrders}
                    cols={cols}
                    rows={topRows}
                    title={topTitle}
                    headerClass={topHeaderClass}
                    cardBgClass={topCardBgClass}
                    sectionId={`${sectionId}-top`}
                    immediateRemoval
                    bare
                    getOrderLabel={getOrderLabel}
                    autoScrollEnabled={autoScrollEnabled}
                    displayZoom={displayZoom}
                />
            </div>
            {/* Bottom 2/3: ready */}
            <div className="min-h-0 flex flex-col overflow-hidden border-t-2 border-gray-200" style={{ flex: 2 }}>
                <DisplaySection
                    orders={bottomOrders}
                    cols={cols}
                    rows={bottomRows}
                    title={bottomTitle}
                    headerClass={bottomHeaderClass}
                    cardBgClass={bottomCardBgClass}
                    sectionId={`${sectionId}-bottom`}
                    bare
                    getOrderLabel={getOrderLabel}
                    autoScrollEnabled={true}
                    displayZoom={displayZoom}
                />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Display() {
    const { t } = useTranslation();
    const router = useRouter();
    const [displayMode, setDisplayMode] = useState<DisplayMode>("ready");
    const [showNumbers, setShowNumbers] = useState<boolean | null>(null);
    const [autoScrollPagesEnabled, setAutoScrollPagesEnabled] = useState(true);
    const [stations, setStations] = useState<Station[]>([]);
    const [stationsLoaded, setStationsLoaded] = useState(false);
    const [refreshingStations, setRefreshingStations] = useState(false);
    const [displayZoom, setDisplayZoom] = useState(100);

    const TITLE_MAP: Record<DisplayMode, string> = {
        ready: t("display.ordersReady"),
        preparing: t("display.ordersPreparing"),
        hybrid: t("display.orders"),
    };

    // Single source of truth: all orders keyed by id
    const [ordersMap, setOrdersMap] = useState<Map<string, ReadyOrder>>(new Map());

    // Mirror ref for SSE alert handlers (read-only access without stale closure)
    const ordersMapRef = useRef<Map<string, ReadyOrder>>(new Map());
    useEffect(() => { ordersMapRef.current = ordersMap; }, [ordersMap]);

    // --- Orders grouped by station ---
    const stationConfirmed = useMemo(() => {
        const map: Record<string, ReadyOrder[]> = {};
        for (const s of stations) map[s.id] = [];
        for (const o of ordersMap.values())
            for (const state of o.orderStationStates ?? [])
                if (state.status === 'CONFIRMED' && state.stationId in map &&
                    !map[state.stationId].find(x => x.id === o.id))
                    map[state.stationId].push(o);
        return map;
    }, [ordersMap, stations]);

    const stationCompleted = useMemo(() => {
        const map: Record<string, ReadyOrder[]> = {};
        for (const s of stations) map[s.id] = [];
        for (const o of ordersMap.values())
            for (const state of o.orderStationStates ?? [])
                if (state.status === 'COMPLETED' && state.stationId in map &&
                    !map[state.stationId].find(x => x.id === o.id))
                    map[state.stationId].push(o);
        return map;
    }, [ordersMap, stations]);

    const displayModeRef = useRef<DisplayMode>("ready");

    const [announcement, setAnnouncement] = useState("");
    const [eventName, setEventName] = useState("");

    // Full-screen overlay
    const [fullscreenAlertEnabled, setFullscreenAlertEnabled] = useState(true);
    const fullscreenAlertEnabledRef = useRef(true);
    useEffect(() => { fullscreenAlertEnabledRef.current = fullscreenAlertEnabled; }, [fullscreenAlertEnabled]);
    const [fsQueue, setFsQueue] = useState<ReadyOrder[]>([]);
    const [currentFsOrder, setCurrentFsOrder] = useState<ReadyOrder | null>(null);
    const [fsExiting, setFsExiting] = useState(false);

    const getOrderLabel = useCallback(
        (order: ReadyOrder) => showNumbers ? String(order.ticketNumber) : order.displayCode,
        [showNumbers]
    );

    // ------------------------------------------------------------------
    // Fetch initial orders
    // ------------------------------------------------------------------
    const fetchOrders = useCallback(async () => {
        try {
            const { dateFrom, dateTo } = getWorkdayBounds();
            const dateParams = `&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;
            const json = await apiFetch<{ data?: Order[]; orders?: Order[] }>(`/api/orders?limit=100${dateParams}&include=ordersStationsStates`);
            const orders: Order[] = json.data || json.orders || (Array.isArray(json) ? json : []);
            if (!Array.isArray(orders)) return;

            const toRO = (o: Order): ReadyOrder => ({
                id: o.id,
                ticketNumber: o.ticketNumber,
                displayCode: o.displayCode,
                status: o.status,
                ordersStations: o.ordersStations,
                orderStationStates: o.orderStationStates,
            });

            setOrdersMap(new Map(orders.filter(o => (o.orderStationStates ?? []).length > 0).map(o => [o.id, toRO(o)])));
        } catch (err) {
            if (handleApiError(err, router)) return;
            console.error("Failed to fetch orders:", err);
        }
    }, [router]);

    // ------------------------------------------------------------------
    // Fetch display config
    // ------------------------------------------------------------------
    useEffect(() => {
        fetch("/api/display-config")
            .then(res => res.ok ? res.json() : null)
            .then(cfg => {
                if (!cfg) {
                    const storedName = localStorage.getItem(EVENT_NAME_KEY);
                    if (storedName) setEventName(storedName);
                    const storedMode = localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode | null;
                    if (storedMode && ["ready", "preparing", "hybrid"].includes(storedMode)) { setDisplayMode(storedMode); displayModeRef.current = storedMode; }
                    fetchOrders();
                    return;
                }
                if (cfg.eventName !== undefined) setEventName(cfg.eventName);
                const mode = cfg.displayMode as DisplayMode;
                if (mode && ["ready", "preparing", "hybrid"].includes(mode)) { setDisplayMode(mode); displayModeRef.current = mode; }
                if (typeof cfg.announcement === "string") setAnnouncement(cfg.announcement);
                if (typeof cfg.showNumbers === "boolean") setShowNumbers(cfg.showNumbers);
                if (typeof cfg.fullscreenAlertEnabled === "boolean") { fullscreenAlertEnabledRef.current = cfg.fullscreenAlertEnabled; setFullscreenAlertEnabled(cfg.fullscreenAlertEnabled); }
                if (typeof cfg.autoScrollPagesEnabled === "boolean") setAutoScrollPagesEnabled(cfg.autoScrollPagesEnabled);
                if (typeof cfg.displayZoom === "number" && cfg.displayZoom >= 50 && cfg.displayZoom <= 200) { setDisplayZoom(cfg.displayZoom); localStorage.setItem(DISPLAY_ZOOM_KEY, String(cfg.displayZoom)); }
                fetchOrders();
            })
            .catch(() => {
                const storedName = localStorage.getItem(EVENT_NAME_KEY);
                if (storedName) setEventName(storedName);
                const storedMode = localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode | null;
                if (storedMode && ["ready", "preparing", "hybrid"].includes(storedMode)) { setDisplayMode(storedMode); displayModeRef.current = storedMode; }
                const storedZoom = localStorage.getItem(DISPLAY_ZOOM_KEY);
                if (storedZoom) { const z = parseInt(storedZoom, 10); if (!isNaN(z) && z >= 50 && z <= 200) setDisplayZoom(z); }
                fetchOrders();
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ------------------------------------------------------------------
    // SSE — display config live updates
    // ------------------------------------------------------------------
    useEffect(() => {
        const close = subscribeSSE("/api/display-config/events", {
            onMessage: (payload) => {
                if (!payload || typeof payload !== "object") return;
                const cfg = payload as Partial<DisplayConfig>;
                if (cfg.eventName !== undefined) setEventName(cfg.eventName);
                const mode = cfg.displayMode as DisplayMode;
                if (mode && ["ready", "preparing", "hybrid"].includes(mode)) { setDisplayMode(mode); displayModeRef.current = mode; }
                if (typeof cfg.fullscreenAlertEnabled === "boolean") { fullscreenAlertEnabledRef.current = cfg.fullscreenAlertEnabled; setFullscreenAlertEnabled(cfg.fullscreenAlertEnabled); }
                if (typeof cfg.autoScrollPagesEnabled === "boolean") setAutoScrollPagesEnabled(cfg.autoScrollPagesEnabled);
                if (typeof cfg.displayZoom === "number" && cfg.displayZoom >= 50 && cfg.displayZoom <= 200) { setDisplayZoom(cfg.displayZoom); localStorage.setItem(DISPLAY_ZOOM_KEY, String(cfg.displayZoom)); }
            },
            onError: err => console.error("SSE display-config:", err),
        });
        return () => close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // ------------------------------------------------------------------
    // SSE — order updates
    // ------------------------------------------------------------------
    useEffect(() => {
        const close = subscribeSSE("/api/events/display", {
            // Il tipo evento arriva da `event:`, dal campo `type` del payload o,
            // in ultima istanza, viene dedotto dalla forma del JSON.
            resolveType: resolveOrderEventType,
            // Refetch full state on every reconnect to resync after any missed events
            onOpen: ({ reconnect }) => { if (reconnect) fetchOrders(); },
            onError: err => console.error("SSE display:", err),
            on: {
                "confirmed-order": (data, _frame, type) => {
                    try {
                        const raw = data as ReadyOrder;
                        if (!(raw.ordersStations?.length || raw.orderStationStates?.length)) return;
                        // Il payload dell'evento non porta `status`: lo si deduce dal tipo evento
                        const status = raw.status ?? statusForOrderEvent(type) ?? 'CONFIRMED';
                        // Il payload SSE può contenere solo gli ID delle postazioni.
                        const orderStationStates = (raw.orderStationStates ?? []).length > 0
                            ? raw.orderStationStates!
                            : (raw.ordersStations ?? []).map(stId => ({ stationId: stId, status }));
                        setOrdersMap(prev => new Map(prev).set(String(raw.id), { ...raw, status, orderStationStates }));
                    } catch (err) {
                        console.error("Error handling confirmed-order event:", err);
                    }
                },

                "order-status-update": (data) => {
                    try {
                        const raw = data as ReadyOrder;
                        const sid = String(raw.id);
                        setOrdersMap(prev => {
                            const existing = prev.get(sid);
                            if (!existing) return prev;

                            let orderStationStates = existing.orderStationStates;
                            // The header undo PATCH targets the whole order.
                            if (raw.status === 'COMPLETED') {
                                orderStationStates = (orderStationStates ?? []).map(s =>
                                    s.status === 'PICKED_UP' ? { ...s, status: 'COMPLETED' } : s
                                );
                            } else if (raw.status === 'CONFIRMED') {
                                orderStationStates = (orderStationStates ?? []).map(s =>
                                    s.status === 'COMPLETED' ? { ...s, status: 'CONFIRMED' } : s
                                );
                            }

                            return new Map(prev).set(sid, {
                                ...existing,
                                status: raw.status,
                                displayCode: raw.displayCode,
                                ticketNumber: raw.ticketNumber,
                                orderStationStates,
                            });
                        });
                    } catch (err) {
                        console.error("Error handling order-status-update event:", err);
                    }
                },

                "order-station-status-update": (data) => {
                    try {
                        const { orderId, stationId, status } = data as { orderId: string; stationId: string; status: string };
                        const sid = String(orderId);
                        const mode = displayModeRef.current;

                        setOrdersMap(prev => {
                            const order = prev.get(sid);
                            if (!order) return prev;
                            const existing = order.orderStationStates ?? [];
                            const hasState = existing.some(s => s.stationId === stationId);
                            const updatedStates = hasState
                                ? existing.map(s => s.stationId === stationId ? { ...s, status } : s)
                                : [...existing, { stationId, status }];
                            return new Map(prev).set(sid, { ...order, orderStationStates: updatedStates });
                        });

                        // Alert: station completed — read from ref snapshot (outside setOrdersMap)
                        if (status === 'COMPLETED' && (mode === 'ready' || mode === 'hybrid') && fullscreenAlertEnabledRef.current) {
                            const order = ordersMapRef.current.get(sid);
                            if (order) setFsQueue(q => q.find(o => o.id === sid) ? q : [...q, { ...order, _alertStationId: stationId }]);
                        }
                    } catch (err) {
                        console.error("Error handling order-station-status-update event:", err);
                    }
                },

                "order-cancelled": (data) => {
                    try {
                        const sid = String((data as { id: string | number }).id);
                        setOrdersMap(prev => { const next = new Map(prev); next.delete(sid); return next; });
                    } catch (err) {
                        console.error("Error handling order-cancelled event:", err);
                    }
                },
            },
        });

        return () => close();
    }, [fetchOrders]);

    // ------------------------------------------------------------------
    // SSE — announcement
    // ------------------------------------------------------------------
    useEffect(() => {
        const stored = localStorage.getItem("display-announcement");
        if (stored) setAnnouncement(stored);
        const close = subscribeSSE("/api/announcement/events", {
            onMessage: (data) => {
                const { announcement: text } = (data ?? {}) as { announcement?: string };
                if (typeof text !== "string") return;
                setAnnouncement(text);
                localStorage.setItem("display-announcement", text);
            },
            onError: err => console.error("SSE announcement:", err),
        });
        return () => close();
    }, []);

    // ------------------------------------------------------------------
    // Full-screen overlay
    // ------------------------------------------------------------------
    useEffect(() => {
        if (currentFsOrder || fsQueue.length === 0) return;
        const [next, ...rest] = fsQueue;
        setFsQueue(rest);
        setCurrentFsOrder(next);
        setFsExiting(false);
    }, [currentFsOrder, fsQueue]);

    useEffect(() => {
        if (!currentFsOrder) return;
        const exitTimer = setTimeout(() => setFsExiting(true), 3500);
        const clearTimer = setTimeout(() => setCurrentFsOrder(null), 4000);
        return () => { clearTimeout(exitTimer); clearTimeout(clearTimer); };
    }, [currentFsOrder]);

    const noStations = stationsLoaded && stations.length === 0;
    const hybridAllowed = stations.length <= MAX_STATIONS_FOR_HYBRID;
    const effectiveHybrid = stations.length > 0 && displayMode === "hybrid" && hybridAllowed;
    const effectivePreparing = displayMode === "preparing" || (displayMode === "hybrid" && !hybridAllowed);

    // ------------------------------------------------------------------
    // Render only after the server has provided SHOW_NUMBERS.
    // ------------------------------------------------------------------
    if (showNumbers === null) return <div className="h-screen bg-gray-100" />;

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-gray-100 text-gray-900">
            {!effectiveHybrid && (
                <Header title={TITLE_MAP[displayMode]} eventName={eventName} />
            )}

            {noStations ? (
                <main className="flex flex-1 items-center justify-center p-4">
                    <EmptyStations publicDisplay onRefresh={() => { void fetchStations(); }} refreshing={refreshingStations} />
                </main>
            /* STATIONS — HYBRID (≤3 stations): one card per station split top=prep/bottom=ready */
            ) : effectiveHybrid ? (
                <main className="flex-1 overflow-hidden p-4 flex gap-4">
                    {stations.map((station, idx) => {
                        const sortedTop = [...(stationConfirmed[station.id] ?? [])].sort((a, b) => a.ticketNumber - b.ticketNumber);
                        const sortedBottom = [...(stationCompleted[station.id] ?? [])].sort((a, b) => a.ticketNumber - b.ticketNumber);
                        return (
                            <div key={station.id} className="flex-1 h-full min-w-0">
                                <SplitDisplaySection
                                    stationName={station.name}
                                    topOrders={sortedTop}
                                    bottomOrders={sortedBottom}
                                    topTitle={t("display.preparing")}
                                    bottomTitle={t("display.ready")}
                                    topHeaderClass="bg-yellow-300"
                                    bottomHeaderClass="bg-green-400"
                                    topCardBgClass="bg-yellow-100"
                                    bottomCardBgClass="bg-green-100"
                                    sectionId={`st-${idx}`}
                                    cols={STATION_COLS}
                                    topRows={1}
                                    bottomRows={STATION_HYBRID_ROWS}
                                    getOrderLabel={getOrderLabel}
                                    autoScrollEnabled={autoScrollPagesEnabled}
                                    displayZoom={displayZoom}
                                />
                            </div>
                        );
                    })}
                </main>

            /* STATIONS — PREPARING (or hybrid degraded with >3 stations) */
            ) : effectivePreparing ? (
                <main className="flex-1 overflow-hidden p-4 flex gap-4">
                    {stations.map((station, idx) => {
                        const sorted = [...(stationConfirmed[station.id] ?? [])].sort((a, b) => a.ticketNumber - b.ticketNumber);
                        return (
                            <div key={station.id} className="flex-1 h-full min-w-0">
                                <DisplaySection
                                    orders={sorted}
                                    cols={STATION_COLS}
                                    rows={STATION_ROWS}
                                    title={station.name}
                                    headerClass="bg-yellow-300"
                                    cardBgClass="bg-yellow-100"
                                    sectionId={`st-prep-${idx}`}
                                    immediateRemoval
                                    getOrderLabel={getOrderLabel}
                                    autoScrollEnabled={autoScrollPagesEnabled}
                                    displayZoom={displayZoom}
                                />
                            </div>
                        );
                    })}
                </main>

            /* STATIONS — READY */
            ) : (
                <main className="flex-1 overflow-hidden p-4 flex gap-4">
                    {stations.map((station, idx) => {
                        const sorted = [...(stationCompleted[station.id] ?? [])].sort((a, b) => a.ticketNumber - b.ticketNumber);
                        return (
                            <div key={station.id} className="flex-1 h-full min-w-0">
                                <DisplaySection
                                    orders={sorted}
                                    cols={STATION_COLS}
                                    rows={STATION_ROWS}
                                    title={station.name}
                                    headerClass="bg-green-400"
                                    cardBgClass="bg-green-100"
                                    sectionId={`st-ready-${idx}`}
                                    getOrderLabel={getOrderLabel}
                                    autoScrollEnabled={true}
                                    displayZoom={displayZoom}
                                />
                            </div>
                        );
                    })}
                </main>
            )}

            <Footer announcement={announcement} />

            {/* Full-screen overlay */}
            {currentFsOrder && (
                <div
                    className={`fixed inset-0 z-50 flex items-center justify-center ${fsExiting ? "fullscreen-overlay-backdrop--exit" : "fullscreen-overlay-backdrop"}`}
                    style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
                >
                    <div
                        className={`flex flex-col items-center justify-center rounded-4xl bg-white px-24 py-20 ${fsExiting ? "fullscreen-overlay-card--exit" : "fullscreen-overlay-card"}`}
                        style={{ minWidth: "min(88vw, 900px)", minHeight: "min(70vh, 600px)" }}
                    >
                        <p className="text-4xl font-bold text-gray-500 uppercase tracking-widest mb-6 select-none">
                            {t("display.orderReady")} in <span className="text-black">{stations.find(s => s.id === currentFsOrder._alertStationId)?.name ?? currentFsOrder._alertStationId}</span>
                        </p>
                        <p className="font-black font-mono text-black select-none leading-none" style={{ fontSize: "clamp(8rem, 18vw, 20rem)" }}>
                            {getOrderLabel(currentFsOrder)}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
