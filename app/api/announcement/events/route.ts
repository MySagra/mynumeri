import { getAnnouncement, subscribe } from "@/lib/display-config-store";

export async function GET() {
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;

    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream({
        start(controller) {
            const send = (chunk: string) => {
                try {
                    controller.enqueue(encoder.encode(chunk));
                    return true;
                } catch {
                    return false;
                }
            };

            // Comment line: forces intermediate proxies to flush the stream head
            send(": connected\n\n");

            // Send current value immediately
            const current = getAnnouncement();
            send(`event: announcement\ndata: ${JSON.stringify({ type: "announcement", announcement: current })}\n\n`);

            // Subscribe to future updates
            unsubscribe = subscribe((text) => {
                const ok = send(`event: announcement\ndata: ${JSON.stringify({ type: "announcement", announcement: text })}\n\n`);
                if (!ok) {
                    unsubscribe?.();
                    unsubscribe = null;
                }
            });

            heartbeat = setInterval(() => send(": hb\n\n"), 15000);
        },
        cancel() {
            if (heartbeat) clearInterval(heartbeat);
            unsubscribe?.();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
