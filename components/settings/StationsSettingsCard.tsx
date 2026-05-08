"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function StationsSettingsCard() {
    const { t } = useTranslation();
    const [enabled, setEnabled] = useState(false);
    const [savedEnabled, setSavedEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetch("/api/display-config")
            .then((res) => res.ok ? res.json() : null)
            .then((cfg) => {
                const val = cfg?.stationsEnabled ?? false;
                setEnabled(val);
                setSavedEnabled(val);
            })
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch("/api/display-config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stationsEnabled: enabled }),
            });
            setSavedEnabled(enabled);
            toast.success(t("settings.stationsSaved"));
        } catch {
            toast.error(t("settings.saveError"));
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = enabled !== savedEnabled;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2 select-none">
                    <MapPin className="h-5 w-5 text-amber-600" />
                    <CardTitle>{t("settings.stations")}</CardTitle>
                </div>
                <CardDescription className="select-none">
                    {t("settings.stationsDesc")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-3">
                    <Switch
                        id="stations-enabled"
                        checked={enabled}
                        onCheckedChange={setEnabled}
                        disabled={isLoading}
                    />
                    <Label htmlFor="stations-enabled" className="cursor-pointer">
                        {t("settings.stationsEnabled")}
                    </Label>
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
