import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("mynumeri_token")?.value;

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backendUrl = process.env.API_URL || "http://localhost:3000";

    const response = await fetch(`${backendUrl}/v1/stations`, {
        headers: {
            "Cookie": `mysagra_token=${token}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
}
