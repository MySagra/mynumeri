import NextAuth from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            username: string;
            role: string;
        };
    }

    interface User {
        id?: string;
        username: string;
        role: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        username: string;
        role: string;
    }
}

export interface LoginResponse {
    user: {
        id: string;
        username: string;
        role: string;
    };
    cookieString: string | null;
}

export interface RefreshResponse {
    accessToken: string;
}

export interface ApiError {
    message: string;
}
