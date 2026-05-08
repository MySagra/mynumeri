import { getConfig, updateConfig, type DisplayMode, type NumberDisplay } from "@/lib/display-config-store";

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
    if (["displayCode", "ticketNumber"].includes(body.numberDisplay)) {
        patch.numberDisplay = body.numberDisplay as NumberDisplay;
    }
    if (typeof body.ticketNumberMax === "number" && body.ticketNumberMax >= 0) {
        patch.ticketNumberMax = Math.floor(body.ticketNumberMax);
    }
    if (typeof body.stationsEnabled === "boolean") {
        patch.stationsEnabled = body.stationsEnabled;
    }
    if (typeof body.fullscreenAlertEnabled === "boolean") {
        patch.fullscreenAlertEnabled = body.fullscreenAlertEnabled;
    }

    const updated = updateConfig(patch);
    return Response.json(updated);
}
