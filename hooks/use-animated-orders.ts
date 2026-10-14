import { useEffect, useRef, useState } from "react";

const EXIT_DURATION = 200;

export interface AnimatedOrder<T> {
    key: string;
    order: T | null;
    exiting: boolean;
}

// Keep removed cards in their slots until their exit animation finishes.
export function useAnimatedOrders<T extends { id: string }>(orders: (T | null)[], scope = ""): AnimatedOrder<T>[] {
    const [entries, setEntries] = useState<AnimatedOrder<T>[]>([]);
    const previousScope = useRef(scope);
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const changedPage = previousScope.current !== scope;
            previousScope.current = scope;
            setEntries(prev => {
                const next: AnimatedOrder<T>[] = orders.map((order, index) => ({
                    key: order ? order.id : `blank-${index}`,
                    order,
                    exiting: false,
                }));
                if (!changedPage) {
                    const incoming = new Set(next.map(entry => entry.key));
                    prev.forEach((entry, index) => {
                        if (!entry.order || incoming.has(entry.key)) return;
                        // A blank slot is left behind by display pagination; use it for the exit.
                        const position = Math.min(index, next.length);
                        if (next[position]?.order === null) next[position] = { ...entry, exiting: true };
                        else next.splice(position, 0, { ...entry, exiting: true });
                    });
                }
                if (next.length === prev.length && next.every((entry, i) =>
                    entry.key === prev[i].key && entry.order === prev[i].order && entry.exiting === prev[i].exiting
                )) return prev;
                return next;
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [orders, scope]);

    useEffect(() => {
        const exiting = new Set(entries.filter(entry => entry.exiting).map(entry => entry.key));
        for (const [key, timer] of timers.current) {
            if (!exiting.has(key)) { clearTimeout(timer); timers.current.delete(key); }
        }
        for (const key of exiting) {
            if (timers.current.has(key)) continue;
            const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : EXIT_DURATION;
            timers.current.set(key, setTimeout(() => {
                timers.current.delete(key);
                setEntries(prev => prev.filter(entry => entry.key !== key || !entry.exiting));
            }, duration));
        }
    }, [entries]);

    useEffect(() => {
        const activeTimers = timers.current;
        return () => { for (const timer of activeTimers.values()) clearTimeout(timer); activeTimers.clear(); };
    }, []);

    return entries;
}
