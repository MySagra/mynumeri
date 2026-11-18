"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSagraSettings } from "@/lib/sagra-settings";
import { cn } from "@/lib/utils";

function Colon() {
    return <span className="clock-blink" aria-hidden>:</span>;
}

function formatParts(date: Date, timeZone?: string) {
    const options: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    };
    try {
        return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).formatToParts(date);
    } catch {
        // Timezone non valida: ora locale del browser
        return new Intl.DateTimeFormat("en-GB", options).formatToParts(date);
    }
}

/** Ora attuale nel fuso orario della sagra, stile orologio digitale con i due punti lampeggianti. */
export function HeaderClock({ className }: { className?: string }) {
    const { t } = useTranslation();
    const timezone = useSagraSettings()?.timezone;
    // null fino al mount: evita mismatch di idratazione fra ora del server e del client
    const [now, setNow] = useState<Date | null>(null);

    // Tick allineato allo scoccare di ogni secondo
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const tick = () => {
            const date = new Date();
            setNow(date);
            timer = setTimeout(tick, 1000 - date.getMilliseconds());
        };
        timer = setTimeout(tick, 0);
        return () => clearTimeout(timer);
    }, []);

    const parts = now ? formatParts(now, timezone) : [];
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "--";

    return (
        <time
            dateTime={now?.toISOString()}
            title={t("header.clockTooltip", { timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone })}
            className={cn("text-2xl font-semibold tabular-nums tracking-tight select-none", className)}
        >
            {get("hour")}<Colon />{get("minute")}<Colon />{get("second")}
        </time>
    );
}
