/**
 * Deduce il tipo di evento ordine dalla forma del payload.
 *
 * Usato come ultima risorsa da `subscribeSSE` quando né la riga `event:` né il
 * campo `type` del JSON sono disponibili (es. proxy che riscrivono lo stream).
 */
export function resolveOrderEventType(data: unknown): string | undefined {
    if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
    const payload = data as Record<string, unknown>;

    if (payload.orderId !== undefined && payload.stationId !== undefined) {
        return "order-station-status-update";
    }
    if (payload.cancelled === true || payload.deleted === true) {
        return "order-cancelled";
    }
    if (Array.isArray(payload.foodsOrdered) || Array.isArray(payload.ordersStations)
        || Array.isArray(payload.orderStationStates)) {
        return "confirmed-order";
    }
    if (payload.id !== undefined && typeof payload.status === "string") {
        return "order-status-update";
    }
    return undefined;
}

/**
 * Stato implicito dell'ordine per gli eventi il cui payload non porta `status`.
 *
 * Il backend, ad esempio, emette `confirmed-order` con i soli dati identificativi:
 * lo stato va dedotto dal tipo di evento.
 */
const IMPLIED_STATUS: Record<string, Order["status"]> = {
    "confirmed-order": "CONFIRMED",
};

/** Stato da assegnare quando l'evento non lo include; `undefined` se non deducibile. */
export function statusForOrderEvent(type: string): Order["status"] | undefined {
    return IMPLIED_STATUS[type];
}
