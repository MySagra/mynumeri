import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
    if (!req.auth) {
        return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
});

export const config = {
    matcher: ["/manager/:path*", "/settings/:path*"],
};
