import { LoginResponse, RefreshResponse, ApiError } from "@/types/auth";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_URL) {
        this.baseUrl = baseUrl;
    }

    /**
     * Login user with username and password
     * The backend sets refresh token as HTTP-only cookie automatically
     */
    // api-client.ts
    async login(username: string, password: string): Promise<LoginResponse> {
        const response = await fetch(`${this.baseUrl}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({
                message: "Login failed",
            }));
            throw new Error(error.message || "Invalid credentials");
        }

        const setCookieHeader = response.headers.get('set-cookie');
        const userData = await response.json();

        return {
            user: userData,
            cookieString: setCookieHeader
        };
    }

    /**
     * Logout user and revoke refresh token
     */
    async logout(): Promise<void> {
        const response = await fetch(`${this.baseUrl}/auth/logout`, {
            method: "POST",
            credentials: "include", // Sends the refresh token cookie to revoke it
        });

        if (!response.ok) {
            // Don't throw on logout errors, just log them
            console.error("Logout failed:", response.statusText);
        }
    }
}

export const apiClient = new ApiClient();
