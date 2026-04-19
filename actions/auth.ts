"use server";

import { apiClient } from "@/lib/api-client";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Login action that validates credentials with the backend
 * This wraps the authentication flow - actual auth is handled by NextAuth in the authorize callback
 */
export async function login(username: string, password: string) {
    try {
        if (!username || !password) {
            return {
                success: false,
                error: "Username e password sono obbligatori",
            };
        }

        try {
            await apiClient.login(username, password);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Credenziali non valide",
            };
        }
    } catch (error) {
        console.error("Login action error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Errore imprevisto",
        };
    }
}

/**
 * Logout action that revokes refresh token and clears session
 */
export async function logout() {
    try {
        await apiClient.logout();
    } catch (error) {
        console.error("Backend logout error:", error);
    }

    revalidatePath("/");
    return { success: true };
}

/**
 * Get current session from server
 */
export async function getSession() {
    return await auth();
}
