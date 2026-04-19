import { getAnnouncement, subscribe } from "@/lib/display-config-store";

export async function GET() {
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;

    const stream = new ReadableStream({
        start(controller) {
            // Send current value immediately
            const current = getAnnouncement();
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ announcement: current })}\n\n`)
            );

            // Subscribe to future updates
            unsubscribe = subscribe((text) => {
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ announcement: text })}\n\n`)
                    );
                } catch {
                    unsubscribe?.();
                    unsubscribe = null;
                }
            });
        },
        cancel() {
            unsubscribe?.();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    });
}
