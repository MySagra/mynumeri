"use client";

import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function EmptyStations({
    publicDisplay = false,
    onRefresh,
    refreshing = false,
}: {
    publicDisplay?: boolean;
    onRefresh: () => void;
    refreshing?: boolean;
}) {
    const { t } = useTranslation();

    return (
        <div role="status" className={cn(
            "mx-auto flex w-full max-w-lg flex-col items-center gap-3 rounded-xl border p-8 text-center shadow-sm",
            publicDisplay ? "border-gray-200 bg-white text-gray-900" : "border-border bg-card text-card-foreground"
        )}>
            <MapPin className={cn("size-9", publicDisplay ? "text-amber-600" : "text-amber-500")} aria-hidden="true" />
            <h2 className="text-xl font-semibold">{t("common.noPickupStations")}</h2>
            <p className={cn("text-sm", publicDisplay ? "text-gray-600" : "text-muted-foreground")}>
                {t("common.configurePickupStations")}
            </p>
            <Button type="button" onClick={onRefresh} disabled={refreshing} className="mt-2 gap-2">
                <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden="true" />
                {t(refreshing ? "common.refreshingStations" : "common.refreshStations")}
            </Button>
        </div>
    );
}
