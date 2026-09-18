import { subscribeConfig } from "@/lib/display-config-store";

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

            unsubscribe = subscribeConfig((config) => {
                const ok = send(`event: display-config\ndata: ${JSON.stringify({ type: "display-config", ...config })}\n\n`);
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
