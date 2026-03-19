import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { apiClient } from "./api-client";
import { JWT } from "next-auth/jwt";
import { cookies } from "next/headers";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials): Promise<User | null> {
                if (!credentials?.username || !credentials?.password) {
                    throw new Error("Username e password sono obbligatori");
                }

                try {
                    const { user, cookieString } = await apiClient.login(
                        credentials.username,
                        credentials.password
                    );

                    if (cookieString) {
                        const tokenMatch = cookieString.match(/mysagra_token=([^;]+)/);

                        if (tokenMatch && tokenMatch[1]) {
                            // Usiamo l'API nativa di Next.js per "inoltrare" il cookie al browser
                            (await cookies()).set({
                                name: 'mynumeri_token',
                                value: tokenMatch[1],
                                httpOnly: true,
                                secure: process.env.NODE_ENV === 'production',
                                sameSite: 'lax',
                                path: '/',
                                maxAge: 6 * 60 * 60 // 6 ore
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
                        error instanceof Error ? error.message : "Error during the login"
                    );
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }): Promise<JWT> {
            if (user) {
                token.username = user.username;
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            session.user = {
                username: token.username as string,
                role: token.role as string,
            };
            return session;
        },
    },
    cookies: {
        sessionToken: {
            name: 'mynumeri_next-auth.session-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
        callbackUrl: {
            name: 'mynumeri_next-auth.callback-url',
            options: {
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
        csrfToken: {
            name: 'mynumeri_next-auth.csrf-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
    },
    pages: {
        signIn: "/", // Login page route
    },
    session: {
        strategy: "jwt",
        maxAge: 6 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET,
};