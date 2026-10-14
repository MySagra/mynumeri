import { cn } from "@/lib/utils";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { useAnimatedOrders } from "@/hooks/use-animated-orders";

// Share the server-provided SHOW_NUMBERS flag across cards to avoid duplicate requests.
const CONFIG_TTL_MS = 5000;
let configPromise: Promise<{ showNumbers: boolean } | null> | null = null;
let configFetchedAt = 0;

function fetchDisplayConfig(): Promise<{ showNumbers: boolean } | null> {
    const now = Date.now();
    if (!configPromise || now - configFetchedAt > CONFIG_TTL_MS) {
        configFetchedAt = now;
        configPromise = fetch("/api/display-config")
            .then(res => {
                if (!res.ok) throw new Error("Failed to load display config");
                return res.json();
            })
            .catch(err => { configPromise = null; throw err; });
    }
    return configPromise;
}

interface OrdersGridProps {
    className?: string;
    orders: Order[];
    title?: string;
    children?: React.ReactNode;
    status?: Status;
    stationId?: string;
    onPrev?: (order: Order) => void;
    onNext?: (order: Order) => void;
}

export default function OrdersGrid({ className, orders, title, status, stationId, onPrev, onNext, children }: OrdersGridProps) {
    const sortedOrders = useMemo(() => [...orders].sort((a, b) => a.ticketNumber - b.ticketNumber), [orders]);
    const animatedOrders = useAnimatedOrders(sortedOrders);

    return (
        <div className={cn("select-none h-full w-full rounded-xl outline-2 outline-secondary bg-card shadow-lg overflow-hidden flex flex-col", className)}>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {
                    title || children ?
                        <div className="flex place-content-between items-center sticky top-0 bg-card z-10 pt-4 pb-2">
                            {
                                title ? <h2 className="select-none text-2xl font-bold">{title}</h2> : <></>
                            }
                            {children}
                        </div>
                        :
                        <></>
                }
                <div className="flex gap-3 flex-wrap items-start place-content-start">
                    {
                        animatedOrders.map(({ key, order, exiting }) => order && (
                            <div key={stationId ? `${key}-${stationId}` : key} className={cn("w-40", exiting ? "order-card--exit" : "order-card")} inert={exiting}>
                                <OrderCard order={order} status={status} onPrev={exiting ? undefined : onPrev} onNext={exiting ? undefined : onNext} />
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    )
}

interface OrderCardProps {
    order: Order;
    status?: Status;
    onPrev?: (order: Order) => void;
    onNext?: (order: Order) => void;
}

export function OrderCard({ order, status, onPrev, onNext }: OrderCardProps) {
    const [showNumbers, setShowNumbers] = useState<boolean | null>(null);

    useEffect(() => {
        fetchDisplayConfig()
            .then(cfg => { if (cfg && typeof cfg.showNumbers === "boolean") setShowNumbers(cfg.showNumbers); })
            .catch(err => console.error("Failed to load number display mode:", err));
    }, []);

    function addNext() {
        if (onNext) {
            onNext(order);
        }
    }

    function undoPrev() {
        if (onPrev) {
            onPrev(order);
        }
    }

    // Do not render a code while the server's display mode is still unknown.
    if (showNumbers === null) return <div className="h-16" aria-hidden="true" />;

    const orderTitle = showNumbers ? String(order.ticketNumber) : order.displayCode;

    if (status === 'CONFIRMED') {
        return (
            <Button
                variant="outline"
                size="lg"
                onClick={addNext}
                className="w-full select-none h-16 px-4 text-3xl font-bold font-mono whitespace-nowrap hover:bg-primary transition-colors"
                disabled={!onNext}
            >
                {orderTitle}
            </Button>
        )
    }

    if (status === 'COMPLETED') {
        return (
            <div className="w-full flex h-16 rounded-md overflow-hidden shadow-sm border border-input dark:border-input">
                <Button
                    variant="ghost"
                    className="select-none h-full w-12 shrink-0 rounded-none border-r border-input dark:border-input hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-colors"
                    onClick={undoPrev}
                    disabled={!onPrev}
                >
                    <Undo2 className="h-5 w-5" />
                </Button>
                <Button
                    variant="ghost"
                    onClick={addNext}
                    className="min-w-28 select-none h-full px-4 rounded-none text-3xl font-bold font-mono whitespace-nowrap bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors"
                    disabled={!onNext}
                >
                    {orderTitle}
                </Button>
            </div>
        )
    }

    if (status === 'PICKED_UP') {
        return (
            <div className="flex h-16 rounded-md overflow-hidden shadow-sm border border-input dark:border-input">
                <Button
                    variant="outline"
                    className="select-none h-full w-12 shrink-0 rounded-none border-r border-input dark:border-input hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-colors"
                    onClick={undoPrev}
                >
                    <Undo2 className="h-5 w-5" />
                </Button>
                <Button
                    className="min-w-28 h-full px-4 rounded-none text-3xl font-bold font-mono whitespace-nowrap bg-blue-400 hover:bg-blue-500 text-white"
                    disabled
                >
                    {orderTitle}
                </Button>
            </div>
        )
    }

    return (
        <Card
            key={order.id}
        >
            <CardContent className="p-4 flex items-center justify-center h-16">
                <p className="text-3xl font-bold font-mono m-0">{orderTitle}</p>
            </CardContent>
        </Card>
    )
}