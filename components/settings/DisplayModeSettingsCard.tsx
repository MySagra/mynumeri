"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "../ui/label";

export type DisplayMode = "ready" | "preparing" | "hybrid";

const MODES: { value: DisplayMode; label: string; description: string }[] = [
    {
        value: "ready",
        label: "Solo pronti",
        description: "Mostra solo gli ordini pronti per il ritiro",
    },
    {
        value: "preparing",
        label: "Solo in preparazione",
        description: "Mostra solo gli ordini attualmente in preparazione",
    },
    {
        value: "hybrid",
        label: "Vista ibrida",
        description: "¾ della pagina per gli ordini in preparazione e ¼ per gli ordini pronti",
    },
];

export const DISPLAY_MODE_KEY = "display-mode";

export function DisplayModeSettingsCard() {
    const [mode, setMode] = useState<DisplayMode>("ready");

    useEffect(() => {
        const stored = localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode | null;
        if (stored && ["ready", "preparing", "hybrid"].includes(stored)) {
            setMode(stored);
        }
    }, []);

    const handleSelect = (newMode: DisplayMode) => {
        setMode(newMode);
        localStorage.setItem(DISPLAY_MODE_KEY, newMode);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2 select-none">
                    <Monitor className="h-5 w-5 text-amber-600" />
                    <CardTitle>Display</CardTitle>
                </div>
                <CardDescription className="select-none">
                    Modifica la pagina del display
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Label htmlFor="event-name">Modalità operativa</Label>
                <div className="text-sm text-muted-foreground select-none mb-2">
                    Seleziona cosa mostrare nella pagina display pubblica
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {MODES.map(({ value, label, description }) => (
                        <button
                            key={value}
                            onClick={() => handleSelect(value)}
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
                <div className="text-sm mt-4 text-muted-foreground">
                    Ricordati di aggiornare la pagina del display per applicare le modifiche
                </div>
            </CardContent>
        </Card>
    );
}
