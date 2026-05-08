"use client";

import { cn } from "@/lib/utils";
import { OrderCard } from "@/components/manager/orders-grid";
import { PickedUpOrdersSheet } from "@/components/manager/picked-up-orders-sheet";
import { useTranslation } from "react-i18next";

interface StationCardProps {
    className?: string;
    stationId: string;
    stationName: string;
    confirmedOrders: Order[];
    completedOrders: Order[];
    pickedUpOrders: Order[];
    onConfirmedNext: (order: Order) => void;
    onCompletedPrev: (order: Order) => void;
    onCompletedNext: (order: Order) => void;
    onPickupPrev: (order: Order) => void;
}

export function StationCard({
    className,
    stationId,
    stationName,
    confirmedOrders,
    completedOrders,
    pickedUpOrders,
    onConfirmedNext,
    onCompletedPrev,
    onCompletedNext,
    onPickupPrev,
}: StationCardProps) {
    const { t } = useTranslation();

    return (
        <div className={cn("select-none h-full w-full rounded-xl outline-2 outline-secondary bg-card shadow-lg overflow-hidden flex flex-col", className)}>
            {/* Station name */}
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-secondary">
                <h2 className="text-2xl font-bold select-none">{stationName}</h2>
            </div>

            {/* Top half: CONFIRMED */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="shrink-0 px-4 pt-3 pb-2">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide select-none">
                        {t("manager.preparingOrders")}
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <div className="flex gap-3 flex-wrap items-start place-content-start">
                        {confirmedOrders.map(order => (
                            <div key={`${order.id}-${stationId}`} className="min-w-max">
                                <OrderCard order={order} status="CONFIRMED" onNext={onConfirmedNext} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div className="shrink-0 h-px bg-secondary" />

            {/* Bottom half: COMPLETED */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide select-none">
                        {t("manager.readyOrders")}
                    </span>
                    <PickedUpOrdersSheet pickedUpOrders={pickedUpOrders} onPrev={onPickupPrev} stationId={stationId} stationName={stationName} />
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <div className="flex gap-3 flex-wrap items-start place-content-start">
                        {completedOrders.map(order => (
                            <div key={`${order.id}-${stationId}`} className="min-w-max">
                                <OrderCard order={order} status="COMPLETED" onPrev={onCompletedPrev} onNext={onCompletedNext} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
