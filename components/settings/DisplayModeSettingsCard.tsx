"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export type DisplayMode = "ready" | "preparing" | "hybrid";

export const DISPLAY_MODE_KEY = "display-mode";

export function DisplayModeSettingsCard() {
    const { t } = useTranslation();
    const [mode, setMode] = useState<DisplayMode>("ready");
    const [savedMode, setSavedMode] = useState<DisplayMode>("ready");
    const [stationsEnabled, setStationsEnabled] = useState(false);
    const [savedStationsEnabled, setSavedStationsEnabled] = useState(false);
    const [fullscreenAlertEnabled, setFullscreenAlertEnabled] = useState(true);
    const [savedFullscreenAlertEnabled, setSavedFullscreenAlertEnabled] = useState(true);
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
                body: JSON.stringify({ displayMode: mode, stationsEnabled, fullscreenAlertEnabled }),
            });
            setSavedMode(mode);
            setSavedStationsEnabled(stationsEnabled);
            setSavedFullscreenAlertEnabled(fullscreenAlertEnabled);
            localStorage.setItem(DISPLAY_MODE_KEY, mode);
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
        fullscreenAlertEnabled !== savedFullscreenAlertEnabled;

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

                <div className="flex flex-col gap-3 mt-6">
                    <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="fullscreen-alert-enabled" className="cursor-pointer select-none text-sm">
                            {t("settings.fullscreenAlertEnabled")}
                        </Label>
                        <Switch
                            id="fullscreen-alert-enabled"
                            checked={fullscreenAlertEnabled}
                            onCheckedChange={setFullscreenAlertEnabled}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="stations-enabled" className="cursor-pointer select-none text-sm">
                            {t("settings.stationsEnabled")}
                        </Label>
                        <Switch
                            id="stations-enabled"
                            checked={stationsEnabled}
                            onCheckedChange={setStationsEnabled}
                            disabled={isLoading}
                        />
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
