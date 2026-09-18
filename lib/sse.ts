/**
 * Parser e client SSE tolleranti alla frammentazione dei chunk.
 *
 * Dietro proxy/CDN (es. Cloudflare) i frame SSE possono arrivare spezzati a
 * metà riga oppure accorpati (più eventi nello stesso chunk): il parser
 * accumula un buffer e riconosce tutti i terminatori di riga ammessi dalla
 * spec (`\n`, `\r\n`, `\r`), quindi funziona in entrambi i casi.
 */

export type SseFrame = {
    /** Tipo evento (`message` se il campo `event:` non è presente). */
    event: string;
    /** Righe `data:` unite con `\n`. */
    data: string;
    id?: string;
    retry?: number;
};

export type SseParser = {
    /** Consuma un pezzo di testo, emettendo i frame completi trovati. */
    feed: (chunk: string) => void;
    /** Chiude lo stream: emette l'eventuale frame rimasto nel buffer. */
    end: () => void;
};

const LINE_BREAK = /\r\n|\r|\n/;

/** Parser incrementale: `onFrame` viene chiamato una volta per evento completo. */
export function createSseParser(onFrame: (frame: SseFrame) => void): SseParser {
    let buffer = "";
    let eventType = "";
    let dataLines: string[] = [];
    let id: string | undefined;
    let retry: number | undefined;

    const dispatch = () => {
        if (dataLines.length === 0) {
            // Frame senza `data:` (solo commenti/heartbeat o campi sconosciuti).
            eventType = "";
            return;
        }
        const frame: SseFrame = {
            event: eventType || "message",
            data: dataLines.join("\n"),
            id,
            retry,
        };
        eventType = "";
        dataLines = [];
        retry = undefined;
        onFrame(frame);
    };

    const handleLine = (line: string) => {
        if (line === "") { dispatch(); return; }
        if (line.startsWith(":")) return; // commento / heartbeat

        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);

        switch (field) {
            case "event": eventType = value; break;
            case "data": dataLines.push(value); break;
            case "id": if (!value.includes("\0")) id = value; break;
            case "retry": {
                const ms = Number(value);
                if (Number.isFinite(ms) && ms >= 0) retry = ms;
                break;
            }
            default: break; // campo sconosciuto: ignorato per spec
        }
    };

    const drain = (ended: boolean) => {
        for (; ;) {
            const match = LINE_BREAK.exec(buffer);
            if (!match) break;
            // Un `\r` a fine buffer può essere la prima metà di un `\r\n` spezzato
            // fra due chunk: aspetta altri dati prima di chiudere la riga.
            if (!ended && match[0] === "\r" && match.index === buffer.length - 1) break;
            handleLine(buffer.slice(0, match.index));
            buffer = buffer.slice(match.index + match[0].length);
        }
    };

    return {
        feed(chunk: string) {
            if (!chunk) return;
            buffer += chunk;
            drain(false);
        },
        end() {
            drain(true);
            if (buffer) { handleLine(buffer); buffer = ""; }
            dispatch();
        },
    };
}

/** Serializza un frame in testo SSE (usato dalle route che ri-emettono eventi). */
export function serializeSseFrame(frame: Partial<SseFrame> & { data: string }): string {
    let out = "";
    if (frame.id) out += `id: ${frame.id}\n`;
    if (frame.event && frame.event !== "message") out += `event: ${frame.event}\n`;
    if (typeof frame.retry === "number") out += `retry: ${frame.retry}\n`;
    for (const line of frame.data.split("\n")) out += `data: ${line}\n`;
    return out + "\n";
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

/** `type` è il tipo evento risolto (da `event:`, dal payload o da `resolveType`). */
export type SseHandler = (data: unknown, frame: SseFrame, type: string) => void;

export type SseOptions = {
    /** Handler per tipo evento. */
    on?: Record<string, SseHandler>;
    /** Chiamato quando il tipo non è risolvibile o non ha handler dedicato. */
    onMessage?: SseHandler;
    /** Chiamato a ogni connessione riuscita (anche sui riconnect). */
    onOpen?: (info: { reconnect: boolean }) => void;
    onError?: (error: unknown) => void;
    /**
     * Ultima risorsa per dedurre il tipo evento dal payload, quando né `event:`
     * né i campi `type`/`event` del JSON sono presenti.
     */
    resolveType?: (data: unknown, frame: SseFrame) => string | undefined;
    /** Ritardo di riconnessione in ms (default 3000, sovrascritto da `retry:`). */
    retryMs?: number;
};

/** Legge il tipo evento da frame o payload, tollerando proxy che perdono `event:`. */
function resolveEventType(frame: SseFrame, data: unknown, options: SseOptions): string {
    if (frame.event && frame.event !== "message") return frame.event;
    if (data && typeof data === "object") {
        const obj = data as Json;
        for (const key of ["type", "event", "eventType"]) {
            const value = obj[key];
            if (typeof value === "string" && value) return value;
        }
    }
    return options.resolveType?.(data, frame) ?? "message";
}

/**
 * Apre uno stream SSE via `fetch` + reader, con riconnessione automatica e
 * `Last-Event-ID`. Restituisce la funzione di chiusura.
 *
 * Rispetto a `EventSource` non dipende dal fatto che il frame arrivi intero:
 * il buffering è nostro e il tipo evento viene risolto da `event:` oppure dal
 * campo `type` del payload JSON.
 */
export function subscribeSSE(url: string, options: SseOptions = {}): () => void {
    const controller = new AbortController();
    let closed = false;
    let lastEventId: string | undefined;
    let retryMs = options.retryMs ?? 3000;
    let reconnect = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const dispatch = (frame: SseFrame) => {
        if (frame.id) lastEventId = frame.id;
        if (typeof frame.retry === "number") retryMs = frame.retry;

        let data: unknown = frame.data;
        try { data = JSON.parse(frame.data); } catch { /* payload non JSON */ }

        const type = resolveEventType(frame, data, options);
        const handler = options.on?.[type];
        if (handler) handler(data, frame, type);
        else options.onMessage?.(data, frame, type);
    };

    const run = async () => {
        while (!closed) {
            try {
                const response = await fetch(url, {
                    signal: controller.signal,
                    cache: "no-store",
                    credentials: "same-origin",
                    headers: {
                        "Accept": "text/event-stream",
                        ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
                    },
                });

                if (!response.ok || !response.body) {
                    throw new Error(`SSE ${url} -> ${response.status}`);
                }

                options.onOpen?.({ reconnect });
                reconnect = true;

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                const parser = createSseParser(dispatch);

                for (; ;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    parser.feed(decoder.decode(value, { stream: true }));
                }
                parser.feed(decoder.decode());
                parser.end();
            } catch (error) {
                if (closed || controller.signal.aborted) return;
                options.onError?.(error);
            }

            if (closed) return;
            await new Promise<void>(resolve => { timer = setTimeout(resolve, retryMs); });
        }
    };

    void run();

    return () => {
        closed = true;
        if (timer) clearTimeout(timer);
        controller.abort();
    };
}
