import { NextRequest, NextResponse } from "next/server";
import { COOKIE_STORE_NAME } from "@/lib/auth";

export function proxy(request: NextRequest) {
    const token = request.cookies.get(COOKIE_STORE_NAME)?.value;

    if (!token) {
        return NextResponse.redirect(new URL("/?error=session_expired", request.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/manager/:path*", "/settings/:path*"],
};
