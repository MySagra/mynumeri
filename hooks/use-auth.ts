"use client";

import { useSyncExternalStore } from "react";
import { useMounted } from "@/hooks/use-mounted";
import type { AuthUser } from "@/types/auth";

export const USER_STORAGE_KEY = "mynumeri_user";

export interface UseAuthResult {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

let cachedRaw: string | null | undefined;
let cachedUser: AuthUser | null = null;

/** Snapshot stabile: riparsa il JSON solo quando il valore salvato cambia. */
function readUserStorage(): AuthUser | null {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(USER_STORAGE_KEY);
    } catch {
        raw = null;
    }
    if (raw !== cachedRaw) {
        cachedRaw = raw;
        try {
            cachedUser = raw ? (JSON.parse(raw) as AuthUser) : null;
        } catch {
            cachedUser = null;
        }
    }
    return cachedUser;
}

/** Aggiornamenti da altre schede (evento `storage`). */
function subscribeUserStorage(onChange: () => void): () => void {
    const handler = (e: StorageEvent) => { if (e.key === null || e.key === USER_STORAGE_KEY) onChange(); };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
}

/**
 * Hook per leggere i dati dell'utente autenticato dal localStorage.
 * Non effettua chiamate API: legge il valore impostato al login.
 */
export function useAuth(): UseAuthResult {
    const user = useSyncExternalStore(subscribeUserStorage, readUserStorage, () => null);
    // Sul server e durante l'idratazione il localStorage non è ancora leggibile
    const isLoading = !useMounted();

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
    };
}
