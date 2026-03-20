"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings } from "lucide-react";

export const EVENT_NAME_KEY = "display-event-name";

export function GeneralSettingsCard() {
    const [eventName, setEventName] = useState("");

    useEffect(() => {
        const stored = localStorage.getItem(EVENT_NAME_KEY);
        if (stored) setEventName(stored);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setEventName(value);
        localStorage.setItem(EVENT_NAME_KEY, value);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2 select-none">
                    <Settings className="h-5 w-5 text-amber-600" />
                    <CardTitle>Generali</CardTitle>
                </div>
                <CardDescription className="select-none">
                    Configura le impostazioni generali dell'interfaccia di mynumeri
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="space-y-1.5 md:flex-1">
                        <Label htmlFor="event-name">Nome della sagra / festa</Label>
                        <div className="text-sm text-muted-foreground select-none">
                            Viene mostrato nell'header del display accanto al titolo
                        </div>
                    </div>
                    <Input
                        id="event-name"
                        placeholder="es. Sagra 2026"
                        value={eventName}
                        onChange={handleChange}
                        className="w-full md:max-w-sm"
                    />
                </div>
            </CardContent>
        </Card>
    );
}
