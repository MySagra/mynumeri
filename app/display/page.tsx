"use client";

import { Header } from "@/components/display/header";
import { useEffect, useState, useRef, useCallback } from "react";
import { getWorkdayBounds, sortByDate } from "@/utils/utils";
import { type DisplayMode, DISPLAY_MODE_KEY } from "@/components/settings/DisplayModeSettingsCard";
import { EVENT_NAME_KEY } from "@/components/settings/GeneralSettingsCard";

const COLS = 5;
const ROWS = 4;
const CARDS_PER_PAGE = COLS * ROWS; // 20
const PAGE_INTERVAL = 10000; // ms

// Hybrid layout constants
const HYBRID_PREP_COLS = 4;
const HYBRID_PREP_ROWS = 4; // 16 cards
const HYBRID_READY_COLS = 2;
const HYBRID_READY_ROWS = 4; // 8 cards

interface ReadyOrder {
    id: string;
    status: "PENDING" | "CONFIRMED" | "COMPLETED" | "PICKED_UP";
    ticketNumber: number;
    displayCode: string;
}

// ---------------------------------------------------------------------------
// Footer — shown only when there is an announcement
// ---------------------------------------------------------------------------

function Footer({ announcement }: { announcement: string }) {
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
            if (overflows) {
                setDuration(Math.max(12, textW / 100));
            }
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
                Avviso
            </span>
            <span className="flex-shrink-0 w-px h-8 bg-black/20 mr-6" />
            <div ref={containerRef} className="flex-1 overflow-hidden">
                <span
                    ref={measureRef}
                    className="fixed invisible whitespace-nowrap pointer-events-none"
                    aria-hidden="true"
                    style={{ fontSize: "1.25rem" }}
                >
                    {announcement}
                </span>
                {shouldScroll ? (
                    <div
                        className="flex whitespace-nowrap"
                        style={{ animation: `marquee-scroll ${duration}s linear infinite` }}
                    >
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
// DisplaySection — a self-contained panel with its own pagination
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
}

function DisplaySection({ orders, cols, rows, title, headerClass, cardBgClass, sectionId, immediateRemoval = false }: DisplaySectionProps) {
    const cardsPerPage = cols * rows;
    const [currentPage, setCurrentPage] = useState(0);
    const [displayedOrders, setDisplayedOrders] = useState<ReadyOrder[]>(orders);
    const latestRef = useRef<ReadyOrder[]>(orders);

    useEffect(() => {
        latestRef.current = orders;
    }, [orders]);

    const totalPages = Math.max(1, Math.ceil(displayedOrders.length / cardsPerPage));

    // Sync: full sync on single page, append-only on multi-page (+ immediate removal if enabled)
    useEffect(() => {
        setDisplayedOrders(prev => {
            if (prev.length <= cardsPerPage) {
                // Single page: full sync including removals
                return orders;
            }
            // Multi-page: append new arrivals immediately
            const currentIds = new Set(orders.map(o => o.id));
            const prevIds = new Set(prev.map(o => o.id));
            const newOrders = orders.filter(o => !prevIds.has(o.id));
            const base = immediateRemoval ? prev.filter(o => currentIds.has(o.id)) : prev;
            if (newOrders.length === 0 && base.length === prev.length) return prev;
            return [...base, ...newOrders];
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orders, cardsPerPage, immediateRemoval]);

    // Page cycling
    useEffect(() => {
        if (totalPages <= 1) {
            setCurrentPage(0);
            return;
        }
        const timer = setTimeout(() => {
            setCurrentPage((prev) => {
                const next = prev + 1;
                if (next >= totalPages) {
                    setDisplayedOrders([...latestRef.current]);
                    return 0;
                }
                return next;
            });
        }, PAGE_INTERVAL);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, totalPages]);

    const pageOrders = displayedOrders.slice(currentPage * cardsPerPage, (currentPage + 1) * cardsPerPage);

    return (
        <div className="flex flex-col h-full rounded-xl overflow-hidden border-2 border-gray-200 bg-white shadow-sm">
            {/* Section header */}
            <div className={`flex-shrink-0 flex items-center justify-between px-5 ${headerClass}`} style={{ minHeight: "60px" }}>
                <h2 className="text-3xl font-black text-black select-none tracking-tight">{title}</h2>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1 bg-black/10 rounded-lg px-3 py-1">
                        <span className="text-black font-black text-base select-none tabular-nums leading-none">
                            {currentPage + 1}
                        </span>
                        <span className="text-black/50 font-bold text-sm select-none leading-none">/</span>
                        <span className="text-black font-black text-base select-none tabular-nums leading-none">
                            {totalPages}
                        </span>
                    </div>
                )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full bg-black/10 flex-shrink-0">
                {totalPages > 1 && (
                    <div
                        key={`${sectionId}-${currentPage}`}
                        className="h-full bg-black/70 rounded-r-full origin-left"
                        style={{
                            animation: `progress-bar-fill ${PAGE_INTERVAL}ms linear forwards`,
                        }}
                    />
                )}
            </div>

            {/* Orders grid */}
            <div className="flex-1 p-4 overflow-hidden">
                <div
                    className="h-full grid gap-3"
                    style={{
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gridTemplateRows: `repeat(${rows}, 1fr)`,
                    }}
                >
                    {pageOrders.map((order) => (
                        <div
                            key={order.id}
                            className={`${cardBgClass} border-2 border-gray-300 rounded-xl flex items-center justify-center shadow-sm`}
                        >
                            <p
                                className="font-black text-black select-none leading-none"
                                style={{ fontSize: "clamp(2rem, 4vw, 6rem)" }}
                            >
                                {order.displayCode}
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

const TITLE_MAP: Record<DisplayMode, string> = {
    ready: "Ordini Pronti",
    preparing: "Ordini in Preparazione",
    hybrid: "Ordini",
};

export default function Display() {
    const [displayMode, setDisplayMode] = useState<DisplayMode>("ready");

    // Separate order lists
    const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);       // COMPLETED
    const [prepOrders, setPrepOrders] = useState<ReadyOrder[]>([]);         // CONFIRMED

    // For non-hybrid single-grid pagination
    const [currentPage, setCurrentPage] = useState(0);
    const [displayedOrders, setDisplayedOrders] = useState<ReadyOrder[]>([]);
    const latestOrdersRef = useRef<ReadyOrder[]>([]);
    const displayModeRef = useRef<DisplayMode>("ready");

    const [announcement, setAnnouncement] = useState("");
    const [eventName, setEventName] = useState("");

    // The active orders list for single-mode pagination
    const activeOrders = displayMode === "preparing" ? prepOrders : readyOrders;

    useEffect(() => {
        latestOrdersRef.current = activeOrders;
    }, [activeOrders]);

    const totalPages = Math.max(1, Math.ceil(displayedOrders.length / CARDS_PER_PAGE));
    const pageOrders = displayedOrders.slice(
        currentPage * CARDS_PER_PAGE,
        (currentPage + 1) * CARDS_PER_PAGE
    );

    // ------------------------------------------------------------------
    // Fetch display config on mount (eventName, displayMode, announcement)
    // ------------------------------------------------------------------
    useEffect(() => {
        fetch("/api/display-config")
            .then((res) => res.ok ? res.json() : null)
            .then((cfg) => {
                if (!cfg) {
                    const storedName = localStorage.getItem(EVENT_NAME_KEY);
                    if (storedName) setEventName(storedName);
                    const storedMode = localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode | null;
                    if (storedMode && ["ready", "preparing", "hybrid"].includes(storedMode)) {
                        setDisplayMode(storedMode);
                        displayModeRef.current = storedMode;
                    }
                    return;
                }
                if (cfg.eventName !== undefined) setEventName(cfg.eventName);
                const mode = cfg.displayMode as DisplayMode;
                if (mode && ["ready", "preparing", "hybrid"].includes(mode)) {
                    setDisplayMode(mode);
                    displayModeRef.current = mode;
                }
                if (typeof cfg.announcement === "string") setAnnouncement(cfg.announcement);
            })
            .catch(() => {
                const storedName = localStorage.getItem(EVENT_NAME_KEY);
                if (storedName) setEventName(storedName);
                const storedMode = localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode | null;
                if (storedMode && ["ready", "preparing", "hybrid"].includes(storedMode)) {
                    setDisplayMode(storedMode);
                    displayModeRef.current = storedMode;
                }
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ------------------------------------------------------------------
    // SSE — display config live updates (eventName, displayMode)
    // ------------------------------------------------------------------
    useEffect(() => {
        const es = new EventSource("/api/display-config/events");

        es.onmessage = (event) => {
            try {
                const cfg = JSON.parse(event.data);
                if (cfg.eventName !== undefined) setEventName(cfg.eventName);
                const mode = cfg.displayMode as DisplayMode;
                if (mode && ["ready", "preparing", "hybrid"].includes(mode)) {
                    setDisplayMode(mode);
                    displayModeRef.current = mode;
                }
            } catch { /* ignore parse errors */ }
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

            if (mode === "ready" || mode === "hybrid") {
                const res = await fetch(`/api/orders?status=COMPLETED&limit=100${dateParams}`);
                if (res.ok) {
                    const json = await res.json();
                    const orders: Order[] = json.data || json.orders || json || [];
                    const projected: ReadyOrder[] = Array.isArray(orders)
                        ? orders.sort(sortByDate).map(({ id, ticketNumber, displayCode, status }) => ({
                              id, ticketNumber, displayCode, status,
                          }))
                        : [];
                    setReadyOrders(projected);
                }
            }

            if (mode === "preparing" || mode === "hybrid") {
                const res = await fetch(`/api/orders?status=CONFIRMED&limit=100${dateParams}`);
                if (res.ok) {
                    const json = await res.json();
                    const orders: Order[] = json.data || json.orders || json || [];
                    const projected: ReadyOrder[] = Array.isArray(orders)
                        ? orders.sort(sortByDate).map(({ id, ticketNumber, displayCode, status }) => ({
                              id, ticketNumber, displayCode, status,
                          }))
                        : [];
                    setPrepOrders(projected);
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

        es.addEventListener("confirmed-order", (event: MessageEvent) => {
            const data = JSON.parse(event.data) as ReadyOrder;
            const mode = displayModeRef.current;

            if (mode === "preparing" || mode === "hybrid") {
                setPrepOrders((prev) => {
                    if (prev.find((o) => String(o.id) === String(data.id))) return prev;
                    return [...prev, data];
                });
            }
        });

        es.addEventListener("order-status-update", (event: MessageEvent) => {
            const data = JSON.parse(event.data) as ReadyOrder;
            const mode = displayModeRef.current;

            // Handle ready (COMPLETED) orders
            if (mode === "ready" || mode === "hybrid") {
                if (data.status === "COMPLETED") {
                    setReadyOrders((prev) => {
                        if (prev.find((o) => String(o.id) === String(data.id))) return prev;
                        return [...prev, data];
                    });
                } else {
                    setReadyOrders((prev) => prev.filter((o) => String(o.id) !== String(data.id)));
                }
            }

            // Handle prep (CONFIRMED) orders
            if (mode === "preparing" || mode === "hybrid") {
                if (data.status === "CONFIRMED") {
                    setPrepOrders((prev) => {
                        if (prev.find((o) => String(o.id) === String(data.id))) return prev;
                        return [...prev, data];
                    });
                } else {
                    setPrepOrders((prev) => prev.filter((o) => String(o.id) !== String(data.id)));
                }
            }
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
        es.onmessage = (event) => {
            const { announcement: text } = JSON.parse(event.data);
            setAnnouncement(text);
            localStorage.setItem("display-announcement", text);
        };
        return () => es.close();
    }, []);

    // ------------------------------------------------------------------
    // Single-mode: sync displayedOrders with active list
    // ------------------------------------------------------------------
    useEffect(() => {
        if (displayMode === "hybrid") return;
        setDisplayedOrders(activeOrders);
        setCurrentPage(0);
    }, [displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (displayMode === "hybrid") return;
        setDisplayedOrders(prev => {
            if (prev.length <= CARDS_PER_PAGE) {
                // Single page: full sync including removals
                return activeOrders;
            }
            // Multi-page: append new arrivals immediately, leave removals for page wrap
            const prevIds = new Set(prev.map(o => o.id));
            const newOrders = activeOrders.filter(o => !prevIds.has(o.id));
            if (newOrders.length === 0) return prev;
            return [...prev, ...newOrders];
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeOrders, displayMode]);

    // ------------------------------------------------------------------
    // Single-mode: page cycling
    // ------------------------------------------------------------------
    useEffect(() => {
        if (displayMode === "hybrid") return;
        if (totalPages <= 1) {
            setCurrentPage(0);
            return;
        }

        const timer = setTimeout(() => {
            setCurrentPage((prev) => {
                const next = prev + 1;
                if (next >= totalPages) {
                    setDisplayedOrders([...latestOrdersRef.current]);
                    return 0;
                }
                return next;
            });
        }, PAGE_INTERVAL);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, totalPages, displayMode]);

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <div className="h-screen flex flex-col overflow-hidden bg-gray-100 text-gray-900">
            <Header
                pageKey={currentPage}
                showProgress={displayMode !== "hybrid" && totalPages > 1}
                currentPage={currentPage}
                totalPages={totalPages}
                title={TITLE_MAP[displayMode]}
                eventName={eventName}
            />

            {/* HYBRID MODE */}
            {displayMode === "hybrid" ? (
                <main className="flex-1 overflow-hidden p-4 grid grid-cols-4 gap-4">
                    <div className="col-span-3 h-full">
                        <DisplaySection
                            orders={prepOrders}
                            cols={HYBRID_PREP_COLS}
                            rows={HYBRID_PREP_ROWS}
                            title="In preparazione"
                            headerClass="bg-yellow-300"
                            cardBgClass="bg-yellow-100"
                            sectionId="prep"
                            immediateRemoval
                        />
                    </div>
                    <div className="col-span-1 h-full">
                        <DisplaySection
                            orders={readyOrders}
                            cols={HYBRID_READY_COLS}
                            rows={HYBRID_READY_ROWS}
                            title="Pronti"
                            headerClass="bg-green-400"
                            cardBgClass="bg-green-100"
                            sectionId="ready"
                        />
                    </div>
                </main>
            ) : (
                /* SINGLE MODE (ready or preparing) */
                <main className="flex-1 overflow-hidden p-4">
                    <div
                        className="h-full grid gap-3"
                        style={{
                            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                        }}
                    >
                        {pageOrders.map((order) => (
                            <div
                                key={order.id}
                                className="order-card bg-white border-2 border-gray-200 rounded-2xl flex items-center justify-center shadow-sm"
                            >
                                <p
                                    className="font-black text-black select-none leading-none"
                                    style={{ fontSize: "clamp(3rem, 6vw, 9rem)" }}
                                >
                                    {order.displayCode}
                                </p>
                            </div>
                        ))}
                    </div>
                </main>
            )}

            <Footer announcement={announcement} />
        </div>
    );
}
