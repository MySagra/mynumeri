import { NextResponse } from "next/server";
import { getAuthToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Proxy verso `GET /v1/settings` del backend (impostazioni centralizzate). */
export async function GET() {
    const token = await getAuthToken();

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backendUrl = process.env.API_URL || "http://localhost:3000";

    try {
        const response = await fetch(`${backendUrl}/v1/settings`, {
            headers: { "Cookie": `${AUTH_COOKIE_NAME}=${token}` },
            cache: "no-store",
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Settings fetch failed:", errorText);
            return NextResponse.json({ error: errorText }, { status: response.status });
        }

        return NextResponse.json(await response.json());
    } catch (error) {
        console.error("Settings proxy error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
