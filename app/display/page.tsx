"use client";

import { Header } from "@/components/display/header";
import { useEffect, useState, useRef, useCallback } from "react";
import { getWorkdayBounds, sortByDate } from "@/utils/utils";
import { type DisplayMode, DISPLAY_MODE_KEY } from "@/components/settings/DisplayModeSettingsCard";
import { EVENT_NAME_KEY } from "@/components/settings/GeneralSettingsCard";
import { NUMBER_DISPLAY_KEY, TICKET_NUMBER_MAX_KEY } from "@/components/settings/NumberDisplaySettingsCard";
import type { NumberDisplay } from "@/lib/display-config-store";
import { useTranslation } from "react-i18next";

const CARDS_PER_PAGE = 40;
const PAGE_INTERVAL = 10000;

const HYBRID_PREP_COLS = 4;
const HYBRID_PREP_ROWS = 4;
const HYBRID_READY_COLS = 2;
const HYBRID_READY_ROWS = 4;

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
        <div className={`${cardBgClass} border-2 border-gray-200 rounded-2xl flex items-center justify-center shadow-sm p-3`} style={{ containerType: "size" }}>
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
}

function DisplaySection({ orders, cols, rows, title, headerClass, cardBgClass, sectionId, immediateRemoval = false, getOrderLabel, bare = false }: DisplaySectionProps) {
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
            const minColW = 100; // minmax(100px, 1fr)
            const minRowH = 70;  // minmax(70px, 1fr)
            const c = Math.max(1, Math.floor((width + gap) / (minColW + gap)));
            const r = Math.max(1, Math.floor((height + gap) / (minRowH + gap)));
            setEffectiveCardsPerPage(c * r);
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

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
    }, [currentPage, totalPages]);

    const pageOrders = displayedOrders.slice(currentPage * cardsPerPage, (currentPage + 1) * cardsPerPage);

    const inner = (
        <>
            <div className={`flex-shrink-0 flex items-center justify-between px-5 ${headerClass}`} style={{ minHeight: "48px" }}>
                <h3 className={`font-bold text-black select-none tracking-tight ${bare ? "text-lg" : "text-3xl font-black"}`}>{title}</h3>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1 bg-black/10 rounded-lg px-3 py-1">
                        <span className="text-black font-black text-base select-none tabular-nums leading-none">{currentPage + 1}</span>
                        <span className="text-black/50 font-bold text-sm select-none leading-none">/</span>
                        <span className="text-black font-black text-base select-none tabular-nums leading-none">{totalPages}</span>
                    </div>
                )}
            </div>
            <div className="h-1.5 w-full bg-black/10 shrink-0">
                {totalPages > 1 && (
                    <div key={`${sectionId}-${currentPage}`} className="h-full bg-black/70 rounded-r-full origin-left" style={{ animation: `progress-bar-fill ${PAGE_INTERVAL}ms linear forwards` }} />
                )}
            </div>
            <div className="flex-1 p-4 overflow-hidden">
                <div ref={gridRef} className="h-full grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(100px, 1fr))`, gridTemplateRows: `repeat(auto-fill, minmax(70px, 1fr))` }}>
                    {pageOrders.map((order, idx) => order ? (
                        <OrderCard key={order.id} order={order} getOrderLabel={getOrderLabel} cardBgClass={cardBgClass} />
                    ) : (
                        <div key={`blank-${idx}`} />
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
}

function SplitDisplaySection({
    stationName,
    topOrders, bottomOrders,
    topTitle, bottomTitle,
    topHeaderClass, bottomHeaderClass,
    topCardBgClass, bottomCardBgClass,
    sectionId, cols, topRows, bottomRows, getOrderLabel,
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
    const [displayMode, setDisplayMode] = useState<DisplayMode>("ready");
    const [numberDisplay, setNumberDisplay] = useState<NumberDisplay>("displayCode");
    const [ticketNumberMax, setTicketNumberMax] = useState<number>(100);
    const [stationsEnabled, setStationsEnabled] = useState(false);
    const [stations, setStations] = useState<Station[]>([]);

    // Per-station order maps (stations mode)
    const [stationConfirmed, setStationConfirmed] = useState<Record<string, ReadyOrder[]>>({});
    const [stationCompleted, setStationCompleted] = useState<Record<string, ReadyOrder[]>>({});

    const TITLE_MAP: Record<DisplayMode, string> = {
        ready: t("display.ordersReady"),
        preparing: t("display.ordersPreparing"),
        hybrid: t("display.orders"),
    };

    // Normal mode order lists
    const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
    const [prepOrders, setPrepOrders] = useState<ReadyOrder[]>([]);

    // Single-mode pagination
    const [currentPage, setCurrentPage] = useState(0);
    const [displayedOrders, setDisplayedOrders] = useState<(ReadyOrder | null)[]>([]);
    const latestOrdersRef = useRef<ReadyOrder[]>([]);
    const displayModeRef = useRef<DisplayMode>("ready");

    const [announcement, setAnnouncement] = useState("");
    const [eventName, setEventName] = useState("");

    const stationsEnabledRef = useRef(false);

    // Refs to current station maps so SSE closures can look up orders by id
    const stationConfirmedRef = useRef<Record<string, ReadyOrder[]>>({});
    const stationCompletedRef = useRef<Record<string, ReadyOrder[]>>({});
    const pickedUpOrdersRef = useRef<Record<string, ReadyOrder>>({});
    useEffect(() => { stationConfirmedRef.current = stationConfirmed; }, [stationConfirmed]);
    useEffect(() => { stationCompletedRef.current = stationCompleted; }, [stationCompleted]);

    // Full-screen overlay
    const [fullscreenAlertEnabled, setFullscreenAlertEnabled] = useState(true);
    const fullscreenAlertEnabledRef = useRef(true);
    useEffect(() => { fullscreenAlertEnabledRef.current = fullscreenAlertEnabled; }, [fullscreenAlertEnabled]);
    const [fsQueue, setFsQueue] = useState<ReadyOrder[]>([]);
    const [currentFsOrder, setCurrentFsOrder] = useState<ReadyOrder | null>(null);
    const [fsExiting, setFsExiting] = useState(false);

    const getOrderLabel = useCallback(
        (order: ReadyOrder) => {
            if (numberDisplay !== "ticketNumber") return order.displayCode;
            if (!ticketNumberMax) return String(order.ticketNumber);
            return String(order.ticketNumber % ticketNumberMax);
        },
        [numberDisplay, ticketNumberMax]
    );

    const activeOrders = displayMode === "preparing" ? prepOrders : readyOrders;

    useEffect(() => { latestOrdersRef.current = activeOrders; }, [activeOrders]);

    const totalPages = Math.max(1, Math.ceil(displayedOrders.length / CARDS_PER_PAGE));
    const pageOrders = displayedOrders.slice(currentPage * CARDS_PER_PAGE, (currentPage + 1) * CARDS_PER_PAGE);

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
                    const storedND = localStorage.getItem(NUMBER_DISPLAY_KEY) as NumberDisplay | null;
                    if (storedND && ["displayCode", "ticketNumber"].includes(storedND)) setNumberDisplay(storedND);
                    const storedMax = localStorage.getItem(TICKET_NUMBER_MAX_KEY);
                    if (storedMax) { const n = parseInt(storedMax, 10); if (!isNaN(n) && n >= 1) setTicketNumberMax(n); }
                    fetchOrders();
                    return;
                }
                if (cfg.eventName !== undefined) setEventName(cfg.eventName);
                const mode = cfg.displayMode as DisplayMode;
                if (mode && ["ready", "preparing", "hybrid"].includes(mode)) { setDisplayMode(mode); displayModeRef.current = mode; }
                if (typeof cfg.announcement === "string") setAnnouncement(cfg.announcement);
                if (cfg.numberDisplay && ["displayCode", "ticketNumber"].includes(cfg.numberDisplay)) setNumberDisplay(cfg.numberDisplay as NumberDisplay);
                if (typeof cfg.ticketNumberMax === "number" && cfg.ticketNumberMax >= 0) setTicketNumberMax(cfg.ticketNumberMax);
                if (typeof cfg.fullscreenAlertEnabled === "boolean") { fullscreenAlertEnabledRef.current = cfg.fullscreenAlertEnabled; setFullscreenAlertEnabled(cfg.fullscreenAlertEnabled); }
                if (cfg.stationsEnabled) {
                    stationsEnabledRef.current = true;
                    setStationsEnabled(true);
                    fetch("/api/stations")
                        .then(r => r.ok ? r.json() : null)
                        .then(data => {
                            if (Array.isArray(data)) {
                                setStations(data);
                                const empty: Record<string, ReadyOrder[]> = {};
                                for (const s of data) empty[s.id] = [];
                                setStationConfirmed({ ...empty });
                                setStationCompleted({ ...empty });
                                fetchOrders();
                            }
                        })
                        .catch(console.error);
                } else {
                    fetchOrders();
                }
            })
            .catch(() => {
                const storedName = localStorage.getItem(EVENT_NAME_KEY);
                if (storedName) setEventName(storedName);
                const storedMode = localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode | null;
                if (storedMode && ["ready", "preparing", "hybrid"].includes(storedMode)) { setDisplayMode(storedMode); displayModeRef.current = storedMode; }
                const storedND = localStorage.getItem(NUMBER_DISPLAY_KEY) as NumberDisplay | null;
                if (storedND && ["displayCode", "ticketNumber"].includes(storedND)) setNumberDisplay(storedND);
                const storedMax = localStorage.getItem(TICKET_NUMBER_MAX_KEY);
                if (storedMax) { const n = parseInt(storedMax, 10); if (!isNaN(n) && n >= 1) setTicketNumberMax(n); }
                fetchOrders();
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ------------------------------------------------------------------
    // SSE — display config live updates
    // ------------------------------------------------------------------
    useEffect(() => {
        const es = new EventSource("/api/display-config/events");
        es.onmessage = event => {
            try {
                const cfg = JSON.parse(event.data);
                if (cfg.eventName !== undefined) setEventName(cfg.eventName);
                const mode = cfg.displayMode as DisplayMode;
                if (mode && ["ready", "preparing", "hybrid"].includes(mode)) { setDisplayMode(mode); displayModeRef.current = mode; }
                if (cfg.numberDisplay && ["displayCode", "ticketNumber"].includes(cfg.numberDisplay)) setNumberDisplay(cfg.numberDisplay as NumberDisplay);
                if (typeof cfg.ticketNumberMax === "number" && cfg.ticketNumberMax >= 0) setTicketNumberMax(cfg.ticketNumberMax);
                if (typeof cfg.fullscreenAlertEnabled === "boolean") { fullscreenAlertEnabledRef.current = cfg.fullscreenAlertEnabled; setFullscreenAlertEnabled(cfg.fullscreenAlertEnabled); }
                if (typeof cfg.stationsEnabled === "boolean") {
                    stationsEnabledRef.current = cfg.stationsEnabled;
                    setStationsEnabled(cfg.stationsEnabled);
                    if (cfg.stationsEnabled) {
                        setReadyOrders([]);
                        setPrepOrders([]);
                        fetch("/api/stations")
                            .then(r => r.ok ? r.json() : null)
                            .then(data => {
                                if (Array.isArray(data)) {
                                    setStations(data);
                                    setStationConfirmed({});
                                    setStationCompleted({});
                                    pickedUpOrdersRef.current = {};
                                    fetchOrders();
                                }
                            })
                            .catch(console.error);
                    } else {
                        setStations([]);
                        setStationConfirmed({});
                        setStationCompleted({});
                        pickedUpOrdersRef.current = {};
                        setReadyOrders([]);
                        setPrepOrders([]);
                        fetchOrders();
                    }
                }
            } catch { /* ignore */ }
        };
        return () => es.close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ------------------------------------------------------------------
    // Fetch initial orders
    // ------------------------------------------------------------------
    const fetchOrders = useCallback(async () => {
        try {
            const { dateFrom, dateTo } = getWorkdayBounds();
            const dateParams = `&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;
            const mode = displayModeRef.current;

            // Always fetch with station states included
            const res = await fetch(`/api/orders?limit=100${dateParams}&include=ordersStationsStates`);
            if (!res.ok) return;
            const json = await res.json();
            const orders: Order[] = json.data || json.orders || (Array.isArray(json) ? json : []);
            if (!Array.isArray(orders)) return;

            if (stationsEnabledRef.current) {
                pickedUpOrdersRef.current = {};
                const confirmedMap: Record<string, ReadyOrder[]> = {};
                const completedMap: Record<string, ReadyOrder[]> = {};
                for (const o of orders) {
                    const ro: ReadyOrder = { id: o.id, ticketNumber: o.ticketNumber, displayCode: o.displayCode, status: o.status, ordersStations: o.ordersStations, orderStationStates: o.orderStationStates };
                    for (const state of o.orderStationStates ?? []) {
                        if (state.status === 'CONFIRMED') {
                            if (!(state.stationId in confirmedMap)) confirmedMap[state.stationId] = [];
                            if (!confirmedMap[state.stationId].find(x => x.id === o.id)) confirmedMap[state.stationId].push(ro);
                        } else if (state.status === 'COMPLETED') {
                            if (!(state.stationId in completedMap)) completedMap[state.stationId] = [];
                            if (!completedMap[state.stationId].find(x => x.id === o.id)) completedMap[state.stationId].push(ro);
                        } else if (state.status === 'PICKED_UP') {
                            // Track in ref so SSE COMPLETED (undo pickup) can find the order
                            pickedUpOrdersRef.current[String(o.id)] = ro;
                        }
                    }
                }
                setStationConfirmed(confirmedMap);
                setStationCompleted(completedMap);
                return;
            }

            // Normal mode: skip orders with no station assignments
            const sorted = orders.filter(o => (o.orderStationStates ?? []).length > 0).sort(sortByDate);
            const toRO = (o: Order): ReadyOrder => ({ id: o.id, ticketNumber: o.ticketNumber, displayCode: o.displayCode, status: o.status });
            if (mode === "ready" || mode === "hybrid") setReadyOrders(sorted.filter(o => o.status === 'COMPLETED').map(toRO));
            if (mode === "preparing" || mode === "hybrid") setPrepOrders(sorted.filter(o => o.status === 'CONFIRMED' || o.status === 'PARTIAL').map(toRO));
        } catch (err) {
            console.error("Failed to fetch orders:", err);
        }
    }, []);

    // ------------------------------------------------------------------
    // SSE — order updates
    // ------------------------------------------------------------------
    useEffect(() => {
        fetchOrders();
        const es = new EventSource("/api/events/display");

        const removeFromAllStationMaps = (orderId: string) => {
            delete pickedUpOrdersRef.current[orderId];
            setStationConfirmed(prev => {
                const next = { ...prev };
                for (const k of Object.keys(next)) next[k] = next[k].filter(o => String(o.id) !== orderId);
                return next;
            });
            setStationCompleted(prev => {
                const next = { ...prev };
                for (const k of Object.keys(next)) next[k] = next[k].filter(o => String(o.id) !== orderId);
                return next;
            });
        };

        es.addEventListener("confirmed-order", (event: MessageEvent) => {
            const data = JSON.parse(event.data) as ReadyOrder;
            const mode = displayModeRef.current;

            // Ignore orders not assigned to any station (universal check)
            if ((data.ordersStations ?? []).length === 0) return;

            if (stationsEnabledRef.current) {
                setStationConfirmed(prev => {
                    const next = { ...prev };
                    for (const stId of data.ordersStations!) {
                        const existing = next[stId] ?? [];
                        if (!existing.find(o => String(o.id) === String(data.id))) next[stId] = [...existing, data];
                    }
                    return next;
                });
                if (mode === "preparing" || mode === "hybrid") {
                    if (fullscreenAlertEnabledRef.current) setFsQueue(q => q.find(o => String(o.id) === String(data.id)) ? q : [...q, data]);
                }
                return;
            }

            if (mode === "preparing" || mode === "hybrid") {
                setPrepOrders(prev => prev.find(o => String(o.id) === String(data.id)) ? prev : [...prev, data]);
            }
            if (mode === "preparing") {
                if (fullscreenAlertEnabledRef.current) setFsQueue(q => q.find(o => String(o.id) === String(data.id)) ? q : [...q, data]);
            }
        });

        es.addEventListener("order-status-update", (event: MessageEvent) => {
            const raw = JSON.parse(event.data);
            const sid = String(raw.id);
            const mode = displayModeRef.current;

            if (stationsEnabledRef.current) {
                // Find order object in refs before clearing state
                let order: ReadyOrder | undefined;
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

                removeFromAllStationMaps(sid);

                if (raw.status === "CONFIRMED" && order) {
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
                } else if (raw.status === "COMPLETED" && order) {
                    const stIds = Object.keys(stationConfirmedRef.current).filter(k =>
                        stationConfirmedRef.current[k].some(o => String(o.id) === sid)
                    );
                    setStationCompleted(prev => {
                        const next = { ...prev };
                        for (const stId of stIds) {
                            if (stId in next && !next[stId].find(o => String(o.id) === sid)) next[stId] = [...next[stId], order!];
                        }
                        return next;
                    });
                    if (mode === "ready" || mode === "hybrid") {
                        if (order && fullscreenAlertEnabledRef.current) setFsQueue(q => q.find(o => String(o.id) === sid) ? q : [...q, order!]);
                    }
                }
                // PICKED_UP: removeFromAllStationMaps already handled above
                return;
            }

            const data = raw as ReadyOrder;
            if (mode === "ready" || mode === "hybrid") {
                if (data.status === "COMPLETED") {
                    setReadyOrders(prev => prev.find(o => String(o.id) === sid) ? prev : [...prev, data]);
                    if (fullscreenAlertEnabledRef.current) setFsQueue(q => q.find(o => String(o.id) === sid) ? q : [...q, data]);
                } else {
                    setReadyOrders(prev => prev.filter(o => String(o.id) !== sid));
                }
            }
            if (mode === "preparing" || mode === "hybrid") {
                if (data.status === "CONFIRMED" || data.status === "PARTIAL") {
                    setPrepOrders(prev => prev.find(o => String(o.id) === sid) ? prev : [...prev, data]);
                } else {
                    setPrepOrders(prev => prev.filter(o => String(o.id) !== sid));
                }
            }
        });

        es.addEventListener("order-station-status-update", (event: MessageEvent) => {
            if (!stationsEnabledRef.current) return;
            try {
                const { orderId, stationId, status } = JSON.parse(event.data);
                const sid = String(orderId);
                const mode = displayModeRef.current;

                if (status === "COMPLETED") {
                    const order = stationConfirmedRef.current[stationId]?.find(o => String(o.id) === sid)
                               ?? pickedUpOrdersRef.current[sid];
                    setStationConfirmed(prev => ({ ...prev, [stationId]: (prev[stationId] ?? []).filter(o => String(o.id) !== sid) }));
                    if (order) {
                        // Don't delete from pickedUpOrdersRef — other stations may still need it
                        setStationCompleted(prev => prev[stationId]?.find(o => String(o.id) === sid) ? prev : { ...prev, [stationId]: [...(prev[stationId] ?? []), order] });
                        if ((mode === "ready" || mode === "hybrid") && fullscreenAlertEnabledRef.current) setFsQueue(q => q.find(o => String(o.id) === sid) ? q : [...q, { ...order, _alertStationId: stationId }]);
                    }
                } else if (status === "CONFIRMED") {
                    const order = stationCompletedRef.current[stationId]?.find(o => String(o.id) === sid)
                               ?? stationConfirmedRef.current[stationId]?.find(o => String(o.id) === sid)
                               ?? pickedUpOrdersRef.current[sid];
                    setStationCompleted(prev => ({ ...prev, [stationId]: (prev[stationId] ?? []).filter(o => String(o.id) !== sid) }));
                    if (order) setStationConfirmed(prev => prev[stationId]?.find(o => String(o.id) === sid) ? prev : { ...prev, [stationId]: [...(prev[stationId] ?? []), order] });
                } else if (status === "PICKED_UP") {
                    const order = stationCompletedRef.current[stationId]?.find(o => String(o.id) === sid)
                               ?? stationConfirmedRef.current[stationId]?.find(o => String(o.id) === sid);
                    if (order) pickedUpOrdersRef.current[sid] = order;
                    setStationConfirmed(prev => ({ ...prev, [stationId]: (prev[stationId] ?? []).filter(o => String(o.id) !== sid) }));
                    setStationCompleted(prev => ({ ...prev, [stationId]: (prev[stationId] ?? []).filter(o => String(o.id) !== sid) }));
                }
            } catch (err) {
                console.error("Error parsing order-station-status-update event:", err);
            }
        });

        es.addEventListener("order-cancelled", (event: MessageEvent) => {
            const data = JSON.parse(event.data) as ReadyOrder;
            const sid = String(data.id);
            if (stationsEnabledRef.current) {
                removeFromAllStationMaps(sid);
                return;
            }
            setReadyOrders(prev => prev.filter(o => String(o.id) !== sid));
            setPrepOrders(prev => prev.filter(o => String(o.id) !== sid));
        });

        return () => es.close();
    }, [fetchOrders]);

    // ------------------------------------------------------------------
    // SSE — announcement
    // ------------------------------------------------------------------
    useEffect(() => {
        const stored = localStorage.getItem("display-announcement");
        if (stored) setAnnouncement(stored);
        const es = new EventSource("/api/announcement/events");
        es.onmessage = event => {
            const { announcement: text } = JSON.parse(event.data);
            setAnnouncement(text);
            localStorage.setItem("display-announcement", text);
        };
        return () => es.close();
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

    // ------------------------------------------------------------------
    // Single-mode pagination
    // ------------------------------------------------------------------
    useEffect(() => {
        if (displayMode === "hybrid" || stationsEnabled) return;
        setDisplayedOrders(activeOrders);
        setCurrentPage(0);
    }, [displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (displayMode === "hybrid" || stationsEnabled) return;
        setDisplayedOrders(prev => {
            const prevItems = prev.filter((o): o is ReadyOrder => o !== null);
            if (prevItems.length <= CARDS_PER_PAGE) return activeOrders;
            const currentIds = new Set(activeOrders.map(o => o.id));
            const prevIds = new Set(prevItems.map(o => o.id));
            const newOrders = activeOrders.filter(o => !prevIds.has(o.id));
            const base = prev.map(o => (o === null || currentIds.has(o.id)) ? o : null);
            if (newOrders.length === 0 && base.every((o, i) => o === prev[i])) return prev;
            return [...base, ...newOrders];
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeOrders, displayMode]);

    useEffect(() => {
        if (displayMode === "hybrid" || stationsEnabled) return;
        if (totalPages <= 1) { setCurrentPage(0); return; }
        const timer = setTimeout(() => {
            setCurrentPage(prev => {
                const next = prev + 1;
                if (next >= totalPages) { setDisplayedOrders([...latestOrdersRef.current]); return 0; }
                return next;
            });
        }, PAGE_INTERVAL);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, totalPages, displayMode]);

    // ------------------------------------------------------------------
    // Derived: effective mode when stations active
    // ------------------------------------------------------------------
    const hybridAllowed = stations.length <= MAX_STATIONS_FOR_HYBRID;
    const effectiveHybrid = stationsEnabled && displayMode === "hybrid" && hybridAllowed;
    const effectivePreparing = stationsEnabled && (displayMode === "preparing" || (displayMode === "hybrid" && !hybridAllowed));
    const effectiveReady = stationsEnabled && displayMode === "ready";

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <div className="h-screen flex flex-col overflow-hidden bg-gray-100 text-gray-900">
            {!effectiveHybrid && (
                <Header
                    pageKey={currentPage}
                    showProgress={!stationsEnabled && displayMode !== "hybrid" && totalPages > 1}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    title={TITLE_MAP[displayMode]}
                    eventName={eventName}
                />
            )}

            {/* STATIONS — HYBRID (≤3 stations): one card per station split top=prep/bottom=ready */}
            {effectiveHybrid ? (
                <main className="flex-1 overflow-hidden p-4 flex gap-4">
                    {stations.map((station, idx) => (
                        <div key={station.id} className="flex-1 h-full min-w-0">
                            <SplitDisplaySection
                                stationName={station.name}
                                topOrders={stationConfirmed[station.id] ?? []}
                                bottomOrders={stationCompleted[station.id] ?? []}
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
                            />
                        </div>
                    ))}
                </main>

            /* STATIONS — PREPARING (or hybrid degraded with >3 stations) */
            ) : effectivePreparing ? (
                <main className="flex-1 overflow-hidden p-4 flex gap-4">
                    {stations.map((station, idx) => (
                        <div key={station.id} className="flex-1 h-full min-w-0">
                            <DisplaySection
                                orders={stationConfirmed[station.id] ?? []}
                                cols={STATION_COLS}
                                rows={STATION_ROWS}
                                title={station.name}
                                headerClass="bg-yellow-300"
                                cardBgClass="bg-yellow-100"
                                sectionId={`st-prep-${idx}`}
                                immediateRemoval
                                getOrderLabel={getOrderLabel}
                            />
                        </div>
                    ))}
                </main>

            /* STATIONS — READY */
            ) : effectiveReady ? (
                <main className="flex-1 overflow-hidden p-4 flex gap-4">
                    {stations.map((station, idx) => (
                        <div key={station.id} className="flex-1 h-full min-w-0">
                            <DisplaySection
                                orders={stationCompleted[station.id] ?? []}
                                cols={STATION_COLS}
                                rows={STATION_ROWS}
                                title={station.name}
                                headerClass="bg-green-400"
                                cardBgClass="bg-green-100"
                                sectionId={`st-ready-${idx}`}
                                getOrderLabel={getOrderLabel}
                            />
                        </div>
                    ))}
                </main>

            /* NORMAL — HYBRID */
            ) : displayMode === "hybrid" ? (
                <main className="flex-1 overflow-hidden p-4 grid grid-cols-4 gap-4">
                    <div className="col-span-3 h-full">
                        <DisplaySection
                            orders={prepOrders}
                            cols={HYBRID_PREP_COLS}
                            rows={HYBRID_PREP_ROWS}
                            title={t("display.preparing")}
                            headerClass="bg-yellow-300"
                            cardBgClass="bg-yellow-100"
                            sectionId="prep"
                            immediateRemoval
                            getOrderLabel={getOrderLabel}
                        />
                    </div>
                    <div className="col-span-1 h-full">
                        <DisplaySection
                            orders={readyOrders}
                            cols={HYBRID_READY_COLS}
                            rows={HYBRID_READY_ROWS}
                            title={t("display.ready")}
                            headerClass="bg-green-400"
                            cardBgClass="bg-green-100"
                            sectionId="ready"
                            getOrderLabel={getOrderLabel}
                        />
                    </div>
                </main>

            /* NORMAL — SINGLE MODE */
            ) : (
                <main className="flex-1 overflow-hidden p-4">
                    <div className="h-full grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(clamp(100px, 14vw, 220px), 1fr))`, gridTemplateRows: `repeat(auto-fill, minmax(80px, 1fr))` }}>
                        {pageOrders.map((order, idx) => order ? (
                            <OrderCard key={order.id} order={order} getOrderLabel={getOrderLabel} />
                        ) : (
                            <div key={`blank-${idx}`} />
                        ))}
                    </div>
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
                            {currentFsOrder._alertStationId
                                ? <>{t("display.orderReady")} in <span className="text-black">{stations.find(s => s.id === currentFsOrder._alertStationId)?.name ?? currentFsOrder._alertStationId}</span></>
                                : currentFsOrder.status === "COMPLETED" ? t("display.orderReadyCode") : t("display.preparingOrderCode")}
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
