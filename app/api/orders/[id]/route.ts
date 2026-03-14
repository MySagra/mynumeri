import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const token = cookieStore.get("mysagra_token")?.value;

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const backendUrl = process.env.API_URL || "http://localhost:3000";

    const response = await fetch(`${backendUrl}/v1/orders/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Cookie": token ? `mysagra_token=${token}` : "",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
}
