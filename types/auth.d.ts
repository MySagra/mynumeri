import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
    interface Session extends DefaultSession {
        user: {
            username: string;
            role: string;
        };
        token: string
        error?: string;
    }

    interface User extends DefaultUser {
        id: string;
        username: string;
        role: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        username: string;
        role: string;
        accessToken: string;
        accessTokenExpires: number;
        error?: string;
    }
}

export interface LoginResponse {
    user: {
        id: string
        username: string;
        role: string;
    },
    cookieString: string | null
}

export interface RefreshResponse {
    accessToken: string;
}

export interface ApiError {
    message: string;
}
