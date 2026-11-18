import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * `false` durante il render sul server e l'idratazione, `true` dopo sul client.
 * Sostituisce il pattern `useState(false)` + `useEffect(() => setMounted(true))`
 * senza il render aggiuntivo causato dal setState nell'effect.
 */
export function useMounted(): boolean {
    return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
