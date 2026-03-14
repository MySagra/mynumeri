"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Example component showing how to use NextAuth session
 * This can be used as a reference for other components
 */
export function SessionInfo() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Caricamento...</CardTitle>
                </CardHeader>
            </Card>
        );
    }

    if (!session) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Non autenticato</CardTitle>
                    <CardDescription>Effettua il login per vedere le tue informazioni</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Informazioni Sessione</CardTitle>
                <CardDescription>Dati utente autenticato</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div>
                    <p className="text-sm font-medium">Username</p>
                    <p className="text-sm text-muted-foreground">{session.user.username}</p>
                </div>
                <div>
                    <p className="text-sm font-medium">Ruolo</p>
                    <p className="text-sm text-muted-foreground">{session.user.role}</p>
                </div>
            </CardContent>
        </Card>
    );
}
