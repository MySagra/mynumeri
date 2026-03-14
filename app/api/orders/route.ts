import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get("mysagra_token")?.value;

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const backendUrl = process.env.API_URL || "http://localhost:3000";

    // Default to passing large limit to fetch all, if not specified
    if (!searchParams.has("limit")) {
        searchParams.set("limit", "100");
    }

    try {
        const response = await fetch(`${backendUrl}/v1/orders?${searchParams.toString()}`, {
            headers: {
                "Cookie": token ? `mysagra_token=${token}` : "",
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Backend fetch failed:", errorText);
            return NextResponse.json({ error: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Proxy fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
