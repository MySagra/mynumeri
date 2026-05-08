"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Monitor, AlertCircle, Play, Grid2x2, ZoomIn, ZoomOut } from "lucide-react";
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
    const [stationsEnabled, setStationsEnabled] = useState(false);
    const [savedStationsEnabled, setSavedStationsEnabled] = useState(false);
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
                if (typeof cfg?.stationsEnabled === "boolean") {
                    setStationsEnabled(cfg.stationsEnabled);
                    setSavedStationsEnabled(cfg.stationsEnabled);
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
                body: JSON.stringify({ displayMode: mode, stationsEnabled, fullscreenAlertEnabled, autoScrollPagesEnabled, displayZoom }),
            });
            setSavedMode(mode);
            setSavedStationsEnabled(stationsEnabled);
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
        stationsEnabled !== savedStationsEnabled ||
        fullscreenAlertEnabled !== savedFullscreenAlertEnabled ||
        autoScrollPagesEnabled !== savedAutoScrollPagesEnabled ||
        displayZoom !== savedDisplayZoom;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2 select-none">
                    <Monitor className="h-5 w-5 text-amber-600" />
                    <CardTitle>{t("settings.display")}</CardTitle>
                </div>
                <CardDescription className="select-none">
                    {t("settings.displayDesc")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Label htmlFor="event-name">{t("settings.operativeMode")}</Label>
                <div className="text-sm text-muted-foreground select-none mb-2">
                    {t("settings.operativeModeDesc")}
                </div>
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Skeleton className="h-20 rounded-xl" />
                        <Skeleton className="h-20 rounded-xl" />
                        <Skeleton className="h-20 rounded-xl" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {MODES.map(({ value, label, description }) => (
                            <button
                                key={value}
                                onClick={() => setMode(value)}
                                className={cn(
                                    "flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all cursor-pointer",
                                    mode === value
                                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                                        : "border-border hover:border-amber-300 hover:bg-muted/50"
                                )}
                            >
                                <span
                                    className={cn(
                                        "font-semibold text-sm",
                                        mode === value ? "text-amber-700 dark:text-amber-400" : ""
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

                <div className="mt-8 space-y-6">
                    {/* Zoom Section */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">{t("settings.displayZoom")}</Label>
                        {isLoading ? (
                            <Skeleton className="h-16 rounded-lg" />
                        ) : (
                            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                <div className="flex items-center justify-center gap-3">
                                    <ZoomOut className="h-4 w-4 text-blue-600" />
                                    <input
                                        type="range"
                                        min="50"
                                        max="200"
                                        step="5"
                                        value={displayZoom}
                                        onChange={(e) => setDisplayZoom(parseInt(e.target.value, 10))}
                                        disabled={isLoading}
                                        className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer dark:bg-blue-800"
                                        style={{
                                            background: `linear-gradient(to right, rgb(96, 165, 250) 0%, rgb(96, 165, 250) ${((displayZoom - 50) / 150) * 100}%, rgb(229, 231, 235) ${((displayZoom - 50) / 150) * 100}%, rgb(229, 231, 235) 100%)`
                                        }}
                                    />
                                    <ZoomIn className="h-4 w-4 text-blue-600" />
                                    <input
                                        type="number"
                                        min="50"
                                        max="200"
                                        value={displayZoom}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            if (!isNaN(val) && val >= 50 && val <= 200) {
                                                setDisplayZoom(val);
                                            }
                                        }}
                                        disabled={isLoading}
                                        className="w-14 h-8 rounded px-2 text-sm font-bold text-center text-blue-700 dark:text-blue-400 bg-white dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 tabular-nums"
                                    />
                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">%</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setDisplayZoom(50)}
                                        className={`py-1.5 px-2 rounded text-xs font-semibold transition-colors ${
                                            displayZoom === 50
                                                ? "bg-blue-600 text-white"
                                                : "bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 hover:bg-blue-300 dark:hover:bg-blue-800"
                                        }`}
                                    >
                                        50%
                                    </button>
                                    <button
                                        onClick={() => setDisplayZoom(100)}
                                        className={`py-1.5 px-2 rounded text-xs font-semibold transition-colors ${
                                            displayZoom === 100
                                                ? "bg-blue-600 text-white"
                                                : "bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 hover:bg-blue-300 dark:hover:bg-blue-800"
                                        }`}
                                    >
                                        100%
                                    </button>
                                    <button
                                        onClick={() => setDisplayZoom(200)}
                                        className={`py-1.5 px-2 rounded text-xs font-semibold transition-colors ${
                                            displayZoom === 200
                                                ? "bg-blue-600 text-white"
                                                : "bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 hover:bg-blue-300 dark:hover:bg-blue-800"
                                        }`}
                                    >
                                        200%
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Flags Grid 2x2 */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">{t("settings.displayOptions")}</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                                    <Label htmlFor="fullscreen-alert-enabled" className="cursor-pointer select-none text-sm font-medium truncate">
                                        {t("settings.fullscreenAlertEnabled")}
                                    </Label>
                                </div>
                                <Switch
                                    id="fullscreen-alert-enabled"
                                    checked={fullscreenAlertEnabled}
                                    onCheckedChange={setFullscreenAlertEnabled}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Play className="h-4 w-4 text-green-600 shrink-0" />
                                    <Label htmlFor="auto-scroll-pages-enabled" className="cursor-pointer select-none text-sm font-medium truncate">
                                        {t("settings.autoScrollPagesEnabled")}
                                    </Label>
                                </div>
                                <Switch
                                    id="auto-scroll-pages-enabled"
                                    checked={autoScrollPagesEnabled}
                                    onCheckedChange={setAutoScrollPagesEnabled}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Grid2x2 className="h-4 w-4 text-purple-600 shrink-0" />
                                    <Label htmlFor="stations-enabled" className="cursor-pointer select-none text-sm font-medium truncate">
                                        {t("settings.stationsEnabled")}
                                    </Label>
                                </div>
                                <Switch
                                    id="stations-enabled"
                                    checked={stationsEnabled}
                                    onCheckedChange={setStationsEnabled}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-4">
                    <Button onClick={handleSave} disabled={!hasChanges || isSaving || isLoading}>
                        {isSaving ? t("settings.saving") : t("settings.save")}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
