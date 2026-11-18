/**
 * Store client delle impostazioni centralizzate del backend (`GET /v1/settings`,
 * evento SSE `settings-update`).
 *
 * mynumeri usa solo: nome della sagra, timezone e `tickets.showNumbers`.
 * Lo stato è condiviso a livello di modulo, così display, manager e card degli
 * ordini leggono la stessa copia senza richieste duplicate.
 */

import { useEffect, useSyncExternalStore } from "react";

export type SagraSettings = {
    sagraName: string;
    /** Timezone IANA (es. "Europe/Rome"); `undefined` se assente. */
    timezone?: string;
    showNumbers: boolean;
    updatedAt?: string;
};

export const SETTINGS_UPDATE_EVENT = "settings-update";

const RETRY_MS = 5000;

let state: SagraSettings | null = null;
let pending: Promise<SagraSettings | null> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);

/** Riconosce il payload di `/v1/settings` / `settings-update`. */
export function isSettingsPayload(data: unknown): boolean {
    return isObject(data) && isObject(data.settings) && isObject(data.sagra);
}

/** Estrae dal payload solo i campi usati da mynumeri. */
export function parseSettingsPayload(data: unknown): SagraSettings | null {
    if (!isSettingsPayload(data)) return null;
    const payload = data as { sagra: Record<string, unknown>; settings: Record<string, unknown>; updatedAt?: unknown };
    const { sagra, settings } = payload;
    const general = isObject(settings.general) ? settings.general : {};
    const tickets = isObject(settings.tickets) ? settings.tickets : {};

    return {
        sagraName: typeof sagra.name === "string" ? sagra.name : "",
        timezone: typeof general.timezone === "string" && general.timezone ? general.timezone : undefined,
        showNumbers: tickets.showNumbers === true,
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : undefined,
    };
}

function emit() {
    listeners.forEach(fn => { try { fn(); } catch { /* listener rimosso */ } });
}

/**
 * Applica un payload completo di impostazioni (fetch o evento SSE).
 * Ignora payload non validi o più vecchi di quello corrente.
 */
export function applySagraSettings(data: unknown): boolean {
    const next = parseSettingsPayload(data);
    if (!next) return false;
    if (state?.updatedAt && next.updatedAt && Date.parse(next.updatedAt) < Date.parse(state.updatedAt)) {
        return false;
    }
    state = next;
    emit();
    return true;
}

export function getSagraSettings(): SagraSettings | null {
    return state;
}

/**
 * Carica le impostazioni (una sola richiesta in volo alla volta).
 * Con `force` ignora la copia in cache, es. dopo una riconnessione SSE.
 */
export function loadSagraSettings(force = false): Promise<SagraSettings | null> {
    if (state && !force) return Promise.resolve(state);
    if (pending) return pending;

    pending = fetch("/api/settings", { cache: "no-store" })
        .then(res => {
            if (!res.ok) throw new Error(`Settings -> ${res.status}`);
            return res.json();
        })
        .then(json => {
            applySagraSettings(json);
            return state;
        })
        .catch(err => {
            console.error("Failed to load settings:", err);
            scheduleRetry();
            return state;
        })
        .finally(() => { pending = null; });

    return pending;
}

/** Ritenta il caricamento finché c'è almeno un componente in ascolto. */
function scheduleRetry() {
    if (state || retryTimer || listeners.size === 0) return;
    retryTimer = setTimeout(() => {
        retryTimer = undefined;
        if (!state && listeners.size > 0) void loadSagraSettings();
    }, RETRY_MS);
}

function subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}

/** Hook React: restituisce le impostazioni (`null` finché non sono caricate). */
export function useSagraSettings(): SagraSettings | null {
    const settings = useSyncExternalStore(subscribe, getSagraSettings, () => null);
    useEffect(() => { void loadSagraSettings(); }, []);
    return settings;
}
