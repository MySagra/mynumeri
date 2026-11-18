import { getConfig, updateConfig } from "@/lib/display-config-store";

export async function GET() {
    return Response.json(getConfig());
}

export async function PATCH(request: Request) {
    const body = await request.json();
    const patch: Parameters<typeof updateConfig>[0] = {};

    if (typeof body.announcement === "string") patch.announcement = body.announcement;
    if (typeof body.displayZoom === "number" && body.displayZoom >= 50 && body.displayZoom <= 200) {
        patch.displayZoom = Math.round(body.displayZoom);
    }

    const updated = updateConfig(patch);
    return Response.json(updated);
}
