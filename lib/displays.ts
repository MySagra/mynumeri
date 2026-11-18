/**
 * Monitor (display) configurati centralmente dal backend (`GET /v1/displays`,
 * evento SSE `display-update` sul canale display).
 *
 * Ogni dispositivo sceglie quale monitor usare:
 * - `manager`: la scelta è salvata in localStorage e sopravvive al ricaricamento;
 * - `display`: la scelta vive solo in memoria, quindi a ogni apertura o
 *   aggiornamento della pagina il monitor viene richiesto di nuovo.
 *
 * Nota: il backend emette `display-update` solo su modifica (PUT/PATCH), non
 * su creazione o eliminazione: per quelle la lista si ricarica alla
 * riconnessione SSE e all'apertura del selettore.
 */

import { useEffect, useSyncExternalStore } from "react";

export type DisplayView = "READY" | "PREPARING" | "HYBRID";
export type DisplayMode = "ready" | "preparing" | "hybrid";

export type DisplayStation = { id: string; name: string };

export type Display = {
    id: string;
    name: string;
    description: string | null;
    view: DisplayView;
    showAlert: boolean;
    autoScroll: boolean;
    stationIds: string[];
    stations?: DisplayStation[];
};

export type DisplayScope = "manager" | "display";

export const DISPLAY_UPDATE_EVENT = "display-update";

const VIEW_TO_MODE: Record<DisplayView, DisplayMode> = {
    READY: "ready",
    PREPARING: "preparing",
    HYBRID: "hybrid",
};

export function displayModeOf(display: Display | null | undefined): DisplayMode {
    return (display && VIEW_TO_MODE[display.view]) || "ready";
}

const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);

/** Riconosce il payload di un display (risposta API o evento `display-update`). */
export function isDisplayPayload(data: unknown): data is Display {
    return isObject(data)
        && typeof data.id === "string"
        && typeof data.view === "string"
        && Array.isArray(data.stationIds);
}

// ---------------------------------------------------------------------------
// Lista dei display
// ---------------------------------------------------------------------------

type DisplaysState = { displays: Display[] | null; error: boolean; loading: boolean };

let listState: DisplaysState = { displays: null, error: false, loading: false };
let pending: Promise<Display[] | null> | null = null;
const listListeners = new Set<() => void>();

function setListState(patch: Partial<DisplaysState>) {
    listState = { ...listState, ...patch };
    listListeners.forEach(fn => { try { fn(); } catch { /* listener rimosso */ } });
}

/** Carica la lista dei display (una sola richiesta in volo alla volta). */
export function loadDisplays(force = false): Promise<Display[] | null> {
    if (listState.displays && !force) return Promise.resolve(listState.displays);
    if (pending) return pending;

    setListState({ loading: true });
    pending = fetch("/api/displays", { cache: "no-store" })
        .then(res => {
            if (!res.ok) throw new Error(`Displays -> ${res.status}`);
            return res.json();
        })
        .then((json: unknown) => {
            const displays = Array.isArray(json) ? json.filter(isDisplayPayload) : [];
            setListState({ displays, error: false, loading: false });
            return displays;
        })
        .catch(err => {
            console.error("Failed to load displays:", err);
            setListState({ error: true, loading: false });
            return listState.displays;
        })
        .finally(() => { pending = null; });

    return pending;
}

/**
 * Applica un evento `display-update`. Il payload porta solo `stationIds`:
 * i nomi delle postazioni già noti vengono conservati.
 */
export function applyDisplayUpdate(data: unknown): boolean {
    if (!isDisplayPayload(data)) return false;
    const current = listState.displays;
    if (!current) { void loadDisplays(true); return true; }

    const previous = current.find(d => d.id === data.id);
    if (!previous) { void loadDisplays(true); return true; }

    const knownStations = new Map((previous.stations ?? []).map(s => [s.id, s]));
    const stations = data.stationIds
        .map(id => knownStations.get(id))
        .filter((s): s is DisplayStation => !!s);
    const updated: Display = {
        id: data.id,
        name: data.name,
        description: data.description ?? null,
        view: data.view,
        showAlert: data.showAlert,
        autoScroll: data.autoScroll,
        stationIds: data.stationIds,
        stations,
    };
    setListState({ displays: current.map(d => d.id === data.id ? updated : d) });

    // Postazioni nuove di cui non si conosce il nome: ricarica per averle complete
    if (stations.length < data.stationIds.length) void loadDisplays(true);
    return true;
}

function subscribeList(fn: () => void) {
    listListeners.add(fn);
    return () => { listListeners.delete(fn); };
}

const SERVER_LIST_STATE: DisplaysState = { displays: null, error: false, loading: false };

/** Hook React: lista dei display, con stato di caricamento/errore. */
export function useDisplays() {
    const state = useSyncExternalStore(subscribeList, () => listState, () => SERVER_LIST_STATE);
    useEffect(() => { void loadDisplays(); }, []);
    return { ...state, reload: () => loadDisplays(true) };
}

// ---------------------------------------------------------------------------
// Display selezionato (per dispositivo)
// ---------------------------------------------------------------------------

const selectionKey = (scope: DisplayScope) => `mynumeri-display:${scope}`;
const selectionListeners = new Set<() => void>();

/** Scope la cui scelta non viene salvata: va richiesta a ogni caricamento. */
const SESSION_ONLY: ReadonlySet<DisplayScope> = new Set(["display"]);
const memorySelection = new Map<DisplayScope, string | null>();

export function getSelectedDisplayId(scope: DisplayScope): string | null {
    if (SESSION_ONLY.has(scope)) return memorySelection.get(scope) ?? null;
    try { return localStorage.getItem(selectionKey(scope)); } catch { return null; }
}

export function setSelectedDisplayId(scope: DisplayScope, id: string | null) {
    if (SESSION_ONLY.has(scope)) {
        memorySelection.set(scope, id);
    } else {
        try {
            if (id) localStorage.setItem(selectionKey(scope), id);
            else localStorage.removeItem(selectionKey(scope));
        } catch { /* localStorage non disponibile */ }
    }
    selectionListeners.forEach(fn => { try { fn(); } catch { /* listener rimosso */ } });
}

function subscribeSelection(fn: () => void) {
    selectionListeners.add(fn);
    return () => { selectionListeners.delete(fn); };
}

/** Hook React: id del display scelto su questo dispositivo (`null` se nessuno). */
export function useSelectedDisplayId(scope: DisplayScope): string | null {
    return useSyncExternalStore(subscribeSelection, () => getSelectedDisplayId(scope), () => null);
}

/**
 * Hook React: display selezionato risolto sulla lista.
 * `ready` è false finché la lista (e la selezione salvata) non sono note.
 */
export function useSelectedDisplay(scope: DisplayScope) {
    const { displays, error, loading, reload } = useDisplays();
    const selectedId = useSelectedDisplayId(scope);
    const display = displays?.find(d => d.id === selectedId) ?? null;
    return {
        display,
        displays,
        ready: displays !== null || error,
        error,
        loading,
        reload,
        select: (id: string | null) => setSelectedDisplayId(scope, id),
    };
}
