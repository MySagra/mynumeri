import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get("mynumeri_token")?.value;

    if (!token) {
        return new Response("Unauthorized", { status: 401 });
    }

    const backendUrl = process.env.API_URL || "http://localhost:3000";

    const response = await fetch(`${backendUrl}/events/display`, {
        signal: request.signal,
        headers: {
            "Accept": "text/event-stream",
            "Cookie": token ? `mysagra_token=${token}` : "",
        }
    });

    if (!response.ok) {
        return new Response("Error connecting to event stream", { status: response.status });
    }

    return new Response(response.body, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    });
}
