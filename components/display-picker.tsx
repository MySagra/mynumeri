"use client";

import { useEffect } from "react";
import { Check, Monitor, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { setSelectedDisplayId, useDisplays, useSelectedDisplayId, type DisplayScope } from "@/lib/displays";

interface DisplayPickerProps {
    scope: DisplayScope;
    /** Stile chiaro fisso per il display pubblico (non segue il tema). */
    publicDisplay?: boolean;
    /** Se presente mostra "Annulla" (cambio monitor con uno già selezionato). */
    onClose?: () => void;
    className?: string;
}

/** Selezione del monitor da usare su questo dispositivo. */
export function DisplayPicker({ scope, publicDisplay = false, onClose, className }: DisplayPickerProps) {
    const { t } = useTranslation();
    const { displays, error, loading, reload } = useDisplays();
    const selectedId = useSelectedDisplayId(scope);

    // Create/delete non emettono eventi SSE: ricarica la lista all'apertura
    useEffect(() => { void reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const choose = (id: string) => {
        setSelectedDisplayId(scope, id);
        onClose?.();
    };

    const VIEW_LABEL = {
        READY: t("displays.viewReady"),
        PREPARING: t("displays.viewPreparing"),
        HYBRID: t("displays.viewHybrid"),
    } as const;

    const muted = publicDisplay ? "text-gray-600" : "text-muted-foreground";
    const surface = publicDisplay ? "border-gray-200 bg-white text-gray-900" : "border-border bg-card text-card-foreground";

    return (
        <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-xl border p-6 shadow-sm", surface, className)}>
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="flex items-center gap-2 text-xl font-semibold select-none">
                        <Monitor className={cn("size-6", publicDisplay ? "text-amber-600" : "text-amber-500")} aria-hidden />
                        {t("displays.chooseTitle")}
                    </h2>
                    <p className={cn("text-sm select-none", muted)}>
                        {t(scope === "manager" ? "displays.chooseDescManager" : "displays.chooseDescDisplay")}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => { void reload(); }} disabled={loading} aria-label={t("displays.refresh")}>
                        <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
                    </Button>
                    {onClose && (
                        <Button type="button" variant="outline" size="icon" onClick={onClose} aria-label={t("displays.cancel")}>
                            <X className="size-4" aria-hidden />
                        </Button>
                    )}
                </div>
            </div>

            {displays === null && !error ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Skeleton className="h-28 rounded-lg" />
                    <Skeleton className="h-28 rounded-lg" />
                </div>
            ) : displays === null || (error && displays.length === 0) ? (
                <p role="alert" className="py-6 text-center text-sm text-destructive">{t("displays.loadError")}</p>
            ) : displays.length === 0 ? (
                <div role="status" className="space-y-1 py-6 text-center">
                    <p className="font-semibold">{t("displays.none")}</p>
                    <p className={cn("text-sm", muted)}>{t("displays.noneDesc")}</p>
                </div>
            ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                    {displays.map(display => {
                        const selected = display.id === selectedId;
                        const stationNames = (display.stations ?? []).map(s => s.name);
                        return (
                            <li key={display.id}>
                                <button
                                    type="button"
                                    onClick={() => choose(display.id)}
                                    aria-pressed={selected}
                                    className={cn(
                                        "flex h-full w-full flex-col gap-2 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                                        selected
                                            ? "border-amber-500 bg-amber-500/10"
                                            : publicDisplay ? "border-gray-200 bg-gray-50 hover:bg-gray-100" : "border-border bg-muted/30 hover:bg-muted/70"
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="truncate text-base font-semibold">{display.name}</span>
                                        {selected && <Check className="size-4 shrink-0 text-amber-600" aria-hidden />}
                                    </span>
                                    {display.description && (
                                        <span className={cn("text-sm", muted)}>{display.description}</span>
                                    )}
                                    <span className="flex flex-wrap gap-1.5 text-xs">
                                        <span className="rounded-full bg-amber-400 px-2 py-0.5 font-medium text-black">
                                            {VIEW_LABEL[display.view] ?? display.view}
                                        </span>
                                        {stationNames.length > 0 ? stationNames.map(name => (
                                            <span key={name} className={cn("rounded-full border px-2 py-0.5", publicDisplay ? "border-gray-300" : "border-border")}>
                                                {name}
                                            </span>
                                        )) : (
                                            <span className={cn("px-1 py-0.5", muted)}>{t("displays.noStations")}</span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
