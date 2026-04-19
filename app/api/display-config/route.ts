import { getConfig, updateConfig, type DisplayMode } from "@/lib/display-config-store";

export async function GET() {
    return Response.json(getConfig());
}

export async function PATCH(request: Request) {
    const body = await request.json();
    const patch: Parameters<typeof updateConfig>[0] = {};

    if (typeof body.announcement === "string") patch.announcement = body.announcement;
    if (typeof body.eventName === "string") patch.eventName = body.eventName;
    if (["ready", "preparing", "hybrid"].includes(body.displayMode)) {
        patch.displayMode = body.displayMode as DisplayMode;
    }

    const updated = updateConfig(patch);
    return Response.json(updated);
}
