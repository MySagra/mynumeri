import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { apiClient } from "./api-client";
import { cookies } from "next/headers";

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    throw new Error("Username e password sono obbligatori");
                }

                try {
                    const { user, cookieString } = await apiClient.login(
                        credentials.username as string,
                        credentials.password as string
                    );

                    if (cookieString) {
                        const tokenMatch = cookieString.match(/mysagra_token=([^;]+)/);
                        if (tokenMatch && tokenMatch[1]) {
                            (await cookies()).set({
                                name: 'mynumeri_token',
                                value: tokenMatch[1],
                                httpOnly: true,
                                secure: process.env.NODE_ENV === 'production',
                                sameSite: 'lax',
                                path: '/',
                                maxAge: 6 * 60 * 60
                            });
                        }
                    }

                    return {
                        id: user.username,
                        username: user.username,
                        role: user.role,
                    };
                } catch (error) {
                    console.error("Login error:", error);
                    throw new Error(
                        error instanceof Error ? error.message : "Errore durante il login"
                    );
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.username = user.username;
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            session.user.username = token.username as string;
            session.user.role = token.role as string;
            return session;
        },
    },
    pages: {
        signIn: "/",
    },
    session: {
        strategy: "jwt",
        maxAge: 6 * 60 * 60,
    },
});
