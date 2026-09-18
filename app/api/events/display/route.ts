import { getAuthToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { createSseParser, serializeSseFrame } from "@/lib/sse";

export const dynamic = 'force-dynamic';

const SSE_HEADERS = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
} as const;

/** Heartbeat: tiene viva la connessione e forza il flush dei proxy intermedi. */
const HEARTBEAT_MS = 15000;

/**
 * Ri-emette il payload upstream con il tipo evento duplicato dentro il JSON.
 *
 * Se un proxy accorpa o spezza i chunk in modo che il client perda la riga
 * `event:`, il tipo resta comunque leggibile dal campo `type` del payload.
 */
function normalize(data: string, event: string): string {
    if (!event || event === "message") return data;
    try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && !("type" in parsed)) {
            return JSON.stringify({ ...parsed, type: event });
        }
    } catch { /* payload non JSON: inoltrato invariato */ }
    return data;
}

export async function GET(request: Request) {
    const token = await getAuthToken();

    if (!token) {
        return new Response("Unauthorized", { status: 401 });
    }

    const backendUrl = process.env.API_URL || "http://localhost:3000";

    const lastEventId = request.headers.get("Last-Event-ID");

    let response: Response;
    try {
        response = await fetch(`${backendUrl}/events/display`, {
            signal: request.signal,
            headers: {
                "Accept": "text/event-stream",
                "Cookie": `${AUTH_COOKIE_NAME}=${token}`,
                ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
            }
        });
    } catch {
        // Return valid SSE stream that closes immediately — client stays disconnected and retries
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode("retry: 3000\n\n"));
                controller.close();
            }
        });
        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
            }
        });
    }

    if (!response.ok || !response.body) {
        return new Response("Error connecting to event stream", { status: response.status });
    }

    const upstream = response.body;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const reader = upstream.getReader();
            const decoder = new TextDecoder();

            const send = (chunk: string) => {
                try { controller.enqueue(encoder.encode(chunk)); } catch { /* client disconnesso */ }
            };

            const parser = createSseParser(frame => {
                send(serializeSseFrame({
                    event: frame.event,
                    id: frame.id,
                    retry: frame.retry,
                    data: normalize(frame.data, frame.event),
                }));
            });

            // Riga di commento: forza i proxy intermedi a flushare la testa dello stream
            send(": connected\n\n");
            const heartbeat = setInterval(() => send(": hb\n\n"), HEARTBEAT_MS);

            try {
                for (; ;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    parser.feed(decoder.decode(value, { stream: true }));
                }
                parser.feed(decoder.decode());
                parser.end();
            } catch { /* stream upstream interrotto */ }

            clearInterval(heartbeat);
            try { controller.close(); } catch { /* già chiuso */ }
        },
        cancel() {
            upstream.cancel().catch(() => { /* già chiuso */ });
        },
    });

    return new Response(stream, { headers: SSE_HEADERS });
}
