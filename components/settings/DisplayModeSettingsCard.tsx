"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Monitor, AlertCircle, Play, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export type DisplayMode = "ready" | "preparing" | "hybrid";

export const DISPLAY_MODE_KEY = "display-mode";
export const AUTO_SCROLL_PAGES_KEY = "auto-scroll-pages";
export const DISPLAY_ZOOM_KEY = "display-zoom";

export function DisplayModeSettingsCard() {
    const { t } = useTranslation();
    const [mode, setMode] = useState<DisplayMode>("ready");
    const [savedMode, setSavedMode] = useState<DisplayMode>("ready");
    const [fullscreenAlertEnabled, setFullscreenAlertEnabled] = useState(true);
    const [savedFullscreenAlertEnabled, setSavedFullscreenAlertEnabled] = useState(true);
    const [autoScrollPagesEnabled, setAutoScrollPagesEnabled] = useState(true);
    const [savedAutoScrollPagesEnabled, setSavedAutoScrollPagesEnabled] = useState(true);
    const [displayZoom, setDisplayZoom] = useState(100);
    const [savedDisplayZoom, setSavedDisplayZoom] = useState(100);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const MODES = [
        {
            value: "ready" as DisplayMode,
            label: t("settings.displayModeReady"),
            description: t("settings.displayModeReadyDesc"),
        },
        {
            value: "preparing" as DisplayMode,
            label: t("settings.displayModePrep"),
            description: t("settings.displayModePrepDesc"),
        },
        {
            value: "hybrid" as DisplayMode,
            label: t("settings.displayModeHybrid"),
            description: t("settings.displayModeHybridDesc"),
        },
    ];

    useEffect(() => {
        fetch("/api/display-config")
            .then((res) => res.ok ? res.json() : null)
            .then((cfg) => {
                const m = cfg?.displayMode as DisplayMode | undefined;
                if (m && ["ready", "preparing", "hybrid"].includes(m)) {
                    setMode(m);
                    setSavedMode(m);
                    localStorage.setItem(DISPLAY_MODE_KEY, m);
                } else {
                    const stored = localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode | null;
                    if (stored && ["ready", "preparing", "hybrid"].includes(stored)) {
                        setMode(stored);
                        setSavedMode(stored);
                    }
                }
                if (typeof cfg?.fullscreenAlertEnabled === "boolean") {
                    setFullscreenAlertEnabled(cfg.fullscreenAlertEnabled);
                    setSavedFullscreenAlertEnabled(cfg.fullscreenAlertEnabled);
                }
                if (typeof cfg?.autoScrollPagesEnabled === "boolean") {
                    setAutoScrollPagesEnabled(cfg.autoScrollPagesEnabled);
                    setSavedAutoScrollPagesEnabled(cfg.autoScrollPagesEnabled);
                }
                if (typeof cfg?.displayZoom === "number" && cfg.displayZoom >= 50 && cfg.displayZoom <= 200) {
                    setDisplayZoom(cfg.displayZoom);
                    setSavedDisplayZoom(cfg.displayZoom);
                    localStorage.setItem(DISPLAY_ZOOM_KEY, String(cfg.displayZoom));
                }
            })
            .catch(() => {
                const stored = localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode | null;
                if (stored && ["ready", "preparing", "hybrid"].includes(stored)) {
                    setMode(stored);
                    setSavedMode(stored);
                }
            })
            .finally(() => setIsLoading(false));
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch("/api/display-config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayMode: mode, fullscreenAlertEnabled, autoScrollPagesEnabled, displayZoom }),
            });
            setSavedMode(mode);
            setSavedFullscreenAlertEnabled(fullscreenAlertEnabled);
            setSavedAutoScrollPagesEnabled(autoScrollPagesEnabled);
            setSavedDisplayZoom(displayZoom);
            localStorage.setItem(DISPLAY_MODE_KEY, mode);
            localStorage.setItem(DISPLAY_ZOOM_KEY, String(displayZoom));
            toast.success(t("settings.displayModeSaved"));
        } catch {
            toast.error(t("settings.saveError"));
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges =
        mode !== savedMode ||
        fullscreenAlertEnabled !== savedFullscreenAlertEnabled ||
        autoScrollPagesEnabled !== savedAutoScrollPagesEnabled ||
        displayZoom !== savedDisplayZoom;

    return (
        <Card className="gap-4 rounded-2xl border-border/70 py-4 shadow-sm">
            <CardHeader className="gap-1 px-4 sm:px-5">
                <div className="flex items-center gap-2 select-none">
                    <Monitor className="h-5 w-5 text-amber-500" />
                    <CardTitle>{t("settings.display")}</CardTitle>
                </div>
                <CardDescription className="select-none">
                    {t("settings.displayDesc")}
                </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-5">
                <Label id="operative-mode-label" className="text-sm font-medium">{t("settings.operativeMode")}</Label>
                <div className="mb-3 text-sm text-muted-foreground select-none">
                    {t("settings.operativeModeDesc")}
                </div>
                {isLoading ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Skeleton className="h-20 rounded-xl" />
                        <Skeleton className="h-20 rounded-xl" />
                        <Skeleton className="h-20 rounded-xl" />
                    </div>
                ) : (
                    <div role="group" aria-labelledby="operative-mode-label" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {MODES.map(({ value, label, description }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setMode(value)}
                                aria-pressed={mode === value}
                                className={cn(
                                    "flex flex-col gap-1 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    mode === value
                                        ? "border-primary/60 bg-primary/10"
                                        : "border-border bg-muted/30 hover:bg-muted/70"
                                )}
                            >
                                <span
                                    className={cn(
                                        "font-semibold text-sm",
                                        mode === value ? "text-foreground" : ""
                                    )}
                                >
                                    {label}
                                </span>
                                <span className="text-xs text-muted-foreground leading-snug">
                                    {description}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="mt-6 space-y-6">
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="display-zoom" className="text-sm font-medium">{t("settings.displayZoom")}</Label>
                            <p className="text-sm text-muted-foreground">{t("settings.displayZoomDesc")}</p>
                        </div>
                        {isLoading ? (
                            <Skeleton className="h-16 rounded-lg" />
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/50 p-3">
                                    <ZoomOut className="h-4 w-4 shrink-0 text-amber-500" />
                                    <input
                                        id="display-zoom"
                                        type="range"
                                        min="50"
                                        max="200"
                                        step="5"
                                        value={displayZoom}
                                        onChange={(e) => setDisplayZoom(parseInt(e.target.value, 10))}
                                        disabled={isLoading}
                                        className="h-2 min-w-0 flex-1 cursor-pointer accent-amber-500"
                                    />
                                    <ZoomIn className="h-4 w-4 shrink-0 text-amber-500" />
                                    <output htmlFor="display-zoom" className="w-12 text-right text-sm font-semibold tabular-nums">{displayZoom}%</output>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        aria-pressed={displayZoom === 50}
                                        onClick={() => setDisplayZoom(50)}
                                        className={cn("rounded-md border px-2 py-1.5 text-xs font-medium transition-colors", displayZoom === 50 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50 hover:bg-muted")}
                                    >
                                        50%
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={displayZoom === 100}
                                        onClick={() => setDisplayZoom(100)}
                                        className={cn("rounded-md border px-2 py-1.5 text-xs font-medium transition-colors", displayZoom === 100 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50 hover:bg-muted")}
                                    >
                                        100%
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={displayZoom === 200}
                                        onClick={() => setDisplayZoom(200)}
                                        className={cn("rounded-md border px-2 py-1.5 text-xs font-medium transition-colors", displayZoom === 200 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50 hover:bg-muted")}
                                    >
                                        200%
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Display options */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">{t("settings.displayOptions")}</Label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/50 p-3">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                                        <Label htmlFor="fullscreen-alert-enabled" className="cursor-pointer text-sm font-medium">{t("settings.fullscreenAlertEnabled")}</Label>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t("settings.fullscreenAlertEnabledDesc")}</p>
                                </div>
                                <Switch
                                    id="fullscreen-alert-enabled"
                                    checked={fullscreenAlertEnabled}
                                    onCheckedChange={setFullscreenAlertEnabled}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/50 p-3">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Play className="h-4 w-4 shrink-0 text-amber-500" />
                                        <Label htmlFor="auto-scroll-pages-enabled" className="cursor-pointer text-sm font-medium">{t("settings.autoScrollPagesEnabled")}</Label>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t("settings.autoScrollPagesEnabledDesc")}</p>
                                </div>
                                <Switch
                                    id="auto-scroll-pages-enabled"
                                    checked={autoScrollPagesEnabled}
                                    onCheckedChange={setAutoScrollPagesEnabled}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex justify-end border-t border-border/70 pt-4">
                    <Button onClick={handleSave} disabled={!hasChanges || isSaving || isLoading}>
                        {isSaving ? t("settings.saving") : t("settings.save")}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
