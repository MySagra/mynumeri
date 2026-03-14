import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    if(!token) {
        return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
}

// Protect these routes (display is now public)
export const config = {
    matcher: [
        "/manager/:path*",
        "/settings/:path*",
    ],
};
