import { getConfig, updateConfig, type DisplayMode } from "@/lib/display-config-store";

export async function GET() {
    return Response.json({ ...getConfig(), showNumbers: process.env.SHOW_NUMBERS === "true" });
}

export async function PATCH(request: Request) {
    const body = await request.json();
    const patch: Parameters<typeof updateConfig>[0] = {};

    if (typeof body.announcement === "string") patch.announcement = body.announcement;
    if (typeof body.eventName === "string") patch.eventName = body.eventName;
    if (["ready", "preparing", "hybrid"].includes(body.displayMode)) {
        patch.displayMode = body.displayMode as DisplayMode;
    }
    if (typeof body.fullscreenAlertEnabled === "boolean") {
        patch.fullscreenAlertEnabled = body.fullscreenAlertEnabled;
    }
    if (typeof body.autoScrollPagesEnabled === "boolean") {
        patch.autoScrollPagesEnabled = body.autoScrollPagesEnabled;
    }
    if (typeof body.displayZoom === "number" && body.displayZoom >= 50 && body.displayZoom <= 200) {
        patch.displayZoom = Math.round(body.displayZoom);
    }

    const updated = updateConfig(patch);
    return Response.json(updated);
}
