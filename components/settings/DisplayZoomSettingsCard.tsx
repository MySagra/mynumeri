"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const DISPLAY_ZOOM_KEY = "display-zoom";

export function DisplayZoomSettingsCard() {
    const { t } = useTranslation();
    const [zoom, setZoom] = useState(100);
    const [savedZoom, setSavedZoom] = useState(100);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetch("/api/display-config")
            .then((res) => res.ok ? res.json() : null)
            .then((cfg) => {
                if (typeof cfg?.displayZoom === "number" && cfg.displayZoom >= 50 && cfg.displayZoom <= 200) {
                    setZoom(cfg.displayZoom);
                    setSavedZoom(cfg.displayZoom);
                    localStorage.setItem(DISPLAY_ZOOM_KEY, String(cfg.displayZoom));
                } else {
                    const stored = localStorage.getItem(DISPLAY_ZOOM_KEY);
                    if (stored) {
                        const parsed = parseInt(stored, 10);
                        if (!isNaN(parsed) && parsed >= 50 && parsed <= 200) {
                            setZoom(parsed);
                            setSavedZoom(parsed);
                        }
                    }
                }
            })
            .catch(() => {
                const stored = localStorage.getItem(DISPLAY_ZOOM_KEY);
                if (stored) {
                    const parsed = parseInt(stored, 10);
                    if (!isNaN(parsed) && parsed >= 50 && parsed <= 200) {
                        setZoom(parsed);
                        setSavedZoom(parsed);
                    }
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
                body: JSON.stringify({ displayZoom: zoom }),
            });
            setSavedZoom(zoom);
            localStorage.setItem(DISPLAY_ZOOM_KEY, String(zoom));
            toast.success(t("settings.zoomSaved"));
        } catch {
            toast.error(t("settings.saveError"));
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = zoom !== savedZoom;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2 select-none">
                    <Zap className="h-5 w-5 text-blue-600" />
                    <CardTitle>{t("settings.displayZoom")}</CardTitle>
                </div>
                <CardDescription className="select-none">
                    {t("settings.displayZoomDesc")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-20 rounded-lg" />
                ) : (
                    <div className="flex flex-col gap-5">
                        <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                            <ZoomOut className="h-5 w-5 text-blue-600" />
                            <div className="flex-1">
                                <input
                                    type="range"
                                    min="50"
                                    max="200"
                                    step="10"
                                    value={zoom}
                                    onChange={(e) => setZoom(parseInt(e.target.value, 10))}
                                    disabled={isLoading}
                                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer dark:bg-blue-800"
                                    style={{
                                        background: `linear-gradient(to right, rgb(96, 165, 250) 0%, rgb(96, 165, 250) ${((zoom - 50) / 150) * 100}%, rgb(229, 231, 235) ${((zoom - 50) / 150) * 100}%, rgb(229, 231, 235) 100%)`
                                    }}
                                />
                            </div>
                            <ZoomIn className="h-5 w-5 text-blue-600" />
                            <span className="text-lg font-bold min-w-14 text-center text-blue-700 dark:text-blue-400 tabular-nums">
                                {zoom}%
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setZoom(50)}
                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                    zoom === 50
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
                                }`}
                            >
                                50%
                            </button>
                            <button
                                onClick={() => setZoom(100)}
                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                    zoom === 100
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
                                }`}
                            >
                                100%
                            </button>
                            <button
                                onClick={() => setZoom(200)}
                                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                    zoom === 200
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
                                }`}
                            >
                                200%
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex justify-end mt-6">
                    <Button onClick={handleSave} disabled={!hasChanges || isSaving || isLoading} className="bg-blue-600 hover:bg-blue-700">
                        {isSaving ? t("settings.saving") : t("settings.save")}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
