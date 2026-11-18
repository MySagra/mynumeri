"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSagraSettings } from "@/lib/sagra-settings";

/**
 * Impostazioni generali in sola lettura: nome della sagra e timezone sono
 * gestiti centralmente dal backend MySagra e aggiornati via SSE.
 */
export function GeneralSettingsCard() {
    const { t } = useTranslation();
    const settings = useSagraSettings();

    const rows = [
        { id: "event-name", label: t("settings.eventName"), desc: t("settings.eventNameDesc"), value: settings?.sagraName ?? "" },
        { id: "timezone", label: t("settings.timezone"), desc: t("settings.timezoneDesc"), value: settings?.timezone ?? "" },
    ];

    return (
        <Card className="gap-4 rounded-2xl border-border/70 py-4 shadow-sm">
            <CardHeader className="gap-1 px-4 sm:px-5">
                <div className="flex items-center gap-2 select-none">
                    <Settings className="h-5 w-5 text-amber-500" />
                    <CardTitle>{t("settings.general")}</CardTitle>
                </div>
                <CardDescription className="select-none">
                    {t("settings.generalDesc")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-5">
                {rows.map(row => (
                    <div key={row.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-0.5 sm:flex-1">
                            <Label htmlFor={row.id}>{row.label}</Label>
                            <div className="text-sm text-muted-foreground select-none">{row.desc}</div>
                        </div>
                        {settings === null ? (
                            <Skeleton className="h-9 w-full rounded-md sm:max-w-sm" />
                        ) : (
                            <Input id={row.id} value={row.value} readOnly disabled className="w-full sm:max-w-sm" />
                        )}
                    </div>
                ))}
                <p className="text-xs text-muted-foreground select-none">{t("settings.managedByBackend")}</p>
            </CardContent>
        </Card>
    );
}
