type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Componenti data/ora di `date` nella timezone `timeZone` (lancia RangeError se non valida). */
function zonedParts(date: Date, timeZone: string): ZonedParts {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
    return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Scostamento (ms) della timezone rispetto a UTC nell'istante `date`. */
function zoneOffsetMs(date: Date, timeZone: string): number {
    const p = zonedParts(date, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - (date.getTime() - date.getMilliseconds());
}

/**
 * Istante in cui inizia il turno corrente (`startHour`:00) nella timezone data.
 * Prima di `startHour` il turno è quello iniziato il giorno precedente.
 * Senza timezone (o con timezone non valida) usa l'ora locale del browser.
 */
export function getShiftStart(startHour: number, timeZone?: string, now: Date = new Date()): Date {
    if (timeZone) {
        try {
            const p = zonedParts(now, timeZone);
            const dayOffset = p.hour < startHour ? -1 : 0;
            // Ora "a muro" nella timezone, interpretata come UTC e poi corretta con l'offset.
            const wall = Date.UTC(p.year, p.month - 1, p.day + dayOffset, startHour, 0, 0, 0);
            let utc = wall - zoneOffsetMs(new Date(wall), timeZone);
            // Secondo passaggio: corregge i casi a cavallo del cambio ora legale.
            utc = wall - zoneOffsetMs(new Date(utc), timeZone);
            return new Date(utc);
        } catch {
            /* timezone non valida: fallback all'ora locale */
        }
    }

    const start = new Date(now);
    if (start.getHours() < startHour) start.setDate(start.getDate() - 1);
    start.setHours(startHour, 0, 0, 0);
    return start;
}

/** Limiti della giornata di lavoro (dalle 8:00 alle 7:59:59 del giorno dopo) nella timezone della sagra. */
export function getWorkdayBounds(timeZone?: string) {
    const start = getShiftStart(8, timeZone);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

    return {
        dateFrom: start.toISOString(),
        dateTo: end.toISOString()
    };
}
export const sortByDate = (a: Order, b: Order) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : Date.now();
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : Date.now();
    return timeA - timeB;
};