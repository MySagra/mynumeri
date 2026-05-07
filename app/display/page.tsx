"use client";

import { Header } from "@/components/display/header";
import { useEffect, useState, useRef, useCallback } from "react";
import { getWorkdayBounds, sortByDate } from "@/utils/utils";
import { type DisplayMode, DISPLAY_MODE_KEY } from "@/components/settings/DisplayModeSettingsCard";
import { EVENT_NAME_KEY } from "@/components/settings/GeneralSettingsCard";
import { NUMBER_DISPLAY_KEY, TICKET_NUMBER_MAX_KEY } from "@/components/settings/NumberDisplaySettingsCard";
import type { NumberDisplay } from "@/lib/display-config-store";
import { useTranslation } from "react-i18next";

const COLS = 5;
const ROWS = 4;
const CARDS_PER_PAGE = COLS * ROWS;
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
    status: "PENDING" | "CONFIRMED" | "COMPLETED" | "PICKED_UP";
    ticketNumber: number;
    displayCode: string;
    ordersStations?: string[];
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
}

function DisplaySection({ orders, cols, rows, title, headerClass, cardBgClass, sectionId, immediateRemoval = false, getOrderLabel }: DisplaySectionProps) {
    const cardsPerPage = cols * rows;
    const [currentPage, setCurrentPage] = useState(0);
    const [displayedOrders, setDisplayedOrders] = useState<ReadyOrder[]>(orders);
    const latestRef = useRef<ReadyOrder[]>(orders);

    useEffect(() => { latestRef.current = orders; }, [orders]);

    const totalPages = Math.max(1, Math.ceil(displayedOrders.length / cardsPerPage));

    useEffect(() => {
        setDisplayedOrders(prev => {
            if (prev.length <= cardsPerPage) return orders;
            const currentIds = new Set(orders.map(o => o.id));
            const prevIds = new Set(prev.map(o => o.id));
            const newOrders = orders.filter(o => !prevIds.has(o.id));
            const base = immediateRemoval ? prev.filter(o => currentIds.has(o.id)) : prev;
            if (newOrders.length === 0 && base.length === prev.length) return prev;
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

    return (
        <div className="flex flex-col h-full rounded-xl overflow-hidden border-2 border-gray-200 bg-white shadow-sm">
            <div className={`flex-shrink-0 flex items-center justify-between px-5 ${headerClass}`} style={{ minHeight: "60px" }}>
                <h2 className="text-3xl font-black text-black select-none tracking-tight">{title}</h2>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1 bg-black/10 rounded-lg px-3 py-1">
                        <span className="text-black font-black text-base select-none tabular-nums leading-none">{currentPage + 1}</span>
                        <span className="text-black/50 font-bold text-sm select-none leading-none">/</span>
                        <span className="text-black font-black text-base select-none tabular-nums leading-none">{totalPages}</span>
                    </div>
                )}
            </div>
            <div className="h-1.5 w-full bg-black/10 flex-shrink-0">
                {totalPages > 1 && (
                    <div key={`${sectionId}-${currentPage}`} className="h-full bg-black/70 rounded-r-full origin-left" style={{ animation: `progress-bar-fill ${PAGE_INTERVAL}ms linear forwards` }} />
                )}
            </div>
            <div className="flex-1 p-4 overflow-hidden">
                <div className="h-full grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                    {pageOrders.map(order => (
                        <div key={order.id} className={`${cardBgClass} border-2 border-gray-300 rounded-xl flex items-center justify-center shadow-sm`}>
                            <p className="font-black text-black select-none leading-none" style={{ fontSize: "clamp(2rem, 4vw, 6rem)" }}>
                                {getOrderLabel(order)}
                            </p>
                        </div>
                    ))}
                </div>
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
    const [displayedOrders, setDisplayedOrders] = useState<ReadyOrder[]>([]);
    const latestOrdersRef = useRef<ReadyOrder[]>([]);
    const displayModeRef = useRef<DisplayMode>("ready");

    const [announcement, setAnnouncement] = useState("");
    const [eventName, setEventName] = useState("");

    const stationsEnabledRef = useRef(false);

    // Full-screen overlay
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
                            }
                        })
                        .catch(console.error);
                }
                fetchOrders();
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

            if (stationsEnabledRef.current) {
                const [confirmedRes, completedRes] = await Promise.all([
                    fetch(`/api/orders?status=CONFIRMED&limit=100${dateParams}`),
                    fetch(`/api/orders?status=COMPLETED&limit=100${dateParams}`),
                ]);

                const buildMap = (orders: Order[]): Record<string, ReadyOrder[]> => {
                    const map: Record<string, ReadyOrder[]> = {};
                    for (const o of orders) {
                        for (const stId of o.ordersStations ?? []) {
                            if (!(stId in map)) map[stId] = [];
                            if (!map[stId].find(x => x.id === o.id)) {
                                map[stId].push({ id: o.id, ticketNumber: o.ticketNumber, displayCode: o.displayCode, status: o.status, ordersStations: o.ordersStations });
                            }
                        }
                    }
                    return map;
                };

                if (confirmedRes.ok) {
                    const json = await confirmedRes.json();
                    const orders: Order[] = json.data || json.orders || json || [];
                    if (Array.isArray(orders)) setStationConfirmed(prev => ({ ...prev, ...buildMap(orders) }));
                }
                if (completedRes.ok) {
                    const json = await completedRes.json();
                    const orders: Order[] = json.data || json.orders || json || [];
                    if (Array.isArray(orders)) setStationCompleted(prev => ({ ...prev, ...buildMap(orders) }));
                }
                return;
            }

            if (mode === "ready" || mode === "hybrid") {
                const res = await fetch(`/api/orders?status=COMPLETED&limit=100${dateParams}`);
                if (res.ok) {
                    const json = await res.json();
                    const orders: Order[] = json.data || json.orders || json || [];
                    setReadyOrders(Array.isArray(orders) ? orders.sort(sortByDate).map(({ id, ticketNumber, displayCode, status }) => ({ id, ticketNumber, displayCode, status })) : []);
                }
            }
            if (mode === "preparing" || mode === "hybrid") {
                const res = await fetch(`/api/orders?status=CONFIRMED&limit=100${dateParams}`);
                if (res.ok) {
                    const json = await res.json();
                    const orders: Order[] = json.data || json.orders || json || [];
                    setPrepOrders(Array.isArray(orders) ? orders.sort(sortByDate).map(({ id, ticketNumber, displayCode, status }) => ({ id, ticketNumber, displayCode, status })) : []);
                }
            }
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
        es.onopen = () => fetchOrders();

        const removeFromAllStationMaps = (orderId: string) => {
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

            if (stationsEnabledRef.current) {
                if (data.ordersStations && data.ordersStations.length > 0) {
                    setStationConfirmed(prev => {
                        const next = { ...prev };
                        for (const stId of data.ordersStations!) {
                            const existing = next[stId] ?? [];
                            if (!existing.find(o => String(o.id) === String(data.id))) next[stId] = [...existing, data];
                        }
                        return next;
                    });
                }
                if (mode === "preparing" || mode === "hybrid") {
                    setFsQueue(q => q.find(o => String(o.id) === String(data.id)) ? q : [...q, data]);
                }
                return;
            }

            if (mode === "preparing" || mode === "hybrid") {
                setPrepOrders(prev => prev.find(o => String(o.id) === String(data.id)) ? prev : [...prev, data]);
            }
            if (mode === "preparing") {
                setFsQueue(q => q.find(o => String(o.id) === String(data.id)) ? q : [...q, data]);
            }
        });

        es.addEventListener("order-status-update", (event: MessageEvent) => {
            const data = JSON.parse(event.data) as ReadyOrder;
            const sid = String(data.id);
            const mode = displayModeRef.current;

            if (stationsEnabledRef.current) {
                if (data.status === "COMPLETED") {
                    // All stations done — move from confirmed to completed for all stations
                    setStationConfirmed(prev => {
                        const next = { ...prev };
                        for (const k of Object.keys(next)) next[k] = next[k].filter(o => String(o.id) !== sid);
                        return next;
                    });
                    if (data.ordersStations && data.ordersStations.length > 0) {
                        setStationCompleted(prev => {
                            const next = { ...prev };
                            for (const stId of data.ordersStations!) {
                                const existing = next[stId] ?? [];
                                if (!existing.find(o => String(o.id) === sid)) next[stId] = [...existing, data];
                            }
                            return next;
                        });
                    }
                    if (mode === "ready" || mode === "hybrid") {
                        setFsQueue(q => q.find(o => String(o.id) === sid) ? q : [...q, data]);
                    }
                } else if (data.status === "PICKED_UP") {
                    removeFromAllStationMaps(sid);
                }
                return;
            }

            if (mode === "ready" || mode === "hybrid") {
                if (data.status === "COMPLETED") {
                    setReadyOrders(prev => prev.find(o => String(o.id) === sid) ? prev : [...prev, data]);
                    setFsQueue(q => q.find(o => String(o.id) === sid) ? q : [...q, data]);
                } else {
                    setReadyOrders(prev => prev.filter(o => String(o.id) !== sid));
                }
            }
            if (mode === "preparing" || mode === "hybrid") {
                if (data.status === "CONFIRMED") {
                    setPrepOrders(prev => prev.find(o => String(o.id) === sid) ? prev : [...prev, data]);
                } else {
                    setPrepOrders(prev => prev.filter(o => String(o.id) !== sid));
                }
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
            if (prev.length <= CARDS_PER_PAGE) return activeOrders;
            const prevIds = new Set(prev.map(o => o.id));
            const newOrders = activeOrders.filter(o => !prevIds.has(o.id));
            if (newOrders.length === 0) return prev;
            return [...prev, ...newOrders];
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
            <Header
                pageKey={currentPage}
                showProgress={!stationsEnabled && displayMode !== "hybrid" && totalPages > 1}
                currentPage={currentPage}
                totalPages={totalPages}
                title={TITLE_MAP[displayMode]}
                eventName={eventName}
            />

            {/* STATIONS — HYBRID (≤3 stations): top=preparing, bottom=ready */}
            {effectiveHybrid ? (
                <main className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
                    <div className="flex-1 flex gap-4 min-h-0">
                        {stations.map((station, idx) => (
                            <div key={station.id} className="flex-1 h-full min-w-0">
                                <DisplaySection
                                    orders={stationConfirmed[station.id] ?? []}
                                    cols={STATION_COLS}
                                    rows={STATION_HYBRID_ROWS}
                                    title={station.name}
                                    headerClass="bg-yellow-300"
                                    cardBgClass="bg-yellow-100"
                                    sectionId={`st-prep-${idx}`}
                                    immediateRemoval
                                    getOrderLabel={getOrderLabel}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 flex gap-4 min-h-0">
                        {stations.map((station, idx) => (
                            <div key={station.id} className="flex-1 h-full min-w-0">
                                <DisplaySection
                                    orders={stationCompleted[station.id] ?? []}
                                    cols={STATION_COLS}
                                    rows={STATION_HYBRID_ROWS}
                                    title={station.name}
                                    headerClass="bg-green-400"
                                    cardBgClass="bg-green-100"
                                    sectionId={`st-ready-${idx}`}
                                    getOrderLabel={getOrderLabel}
                                />
                            </div>
                        ))}
                    </div>
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
                    <div className="h-full grid gap-3" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
                        {pageOrders.map(order => (
                            <div key={order.id} className="order-card bg-white border-2 border-gray-200 rounded-2xl flex items-center justify-center shadow-sm">
                                <p className="font-black text-black select-none leading-none" style={{ fontSize: "clamp(3rem, 6vw, 9rem)" }}>
                                    {getOrderLabel(order)}
                                </p>
                            </div>
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
                        className={`flex flex-col items-center justify-center rounded-[2rem] bg-white px-24 py-20 ${fsExiting ? "fullscreen-overlay-card--exit" : "fullscreen-overlay-card"}`}
                        style={{ minWidth: "min(88vw, 900px)", minHeight: "min(70vh, 600px)" }}
                    >
                        <p className="text-4xl font-bold text-gray-500 uppercase tracking-widest mb-6 select-none">
                            {currentFsOrder.status === "COMPLETED" ? t("display.orderReadyCode") : t("display.preparingOrderCode")}
                        </p>
                        <p className="font-black text-black select-none leading-none" style={{ fontSize: "clamp(8rem, 18vw, 20rem)" }}>
                            {getOrderLabel(currentFsOrder)}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
