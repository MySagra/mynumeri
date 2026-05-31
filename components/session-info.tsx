"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

/**
 * Componente di esempio che mostra come leggere l'utente autenticato.
 */
export function SessionInfo() {
    const { t } = useTranslation();
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t("session.loading")}</CardTitle>
                </CardHeader>
            </Card>
        );
    }

    if (!user) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t("session.unauthenticated")}</CardTitle>
                    <CardDescription>{t("session.loginPrompt")}</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("session.sessionInfo")}</CardTitle>
                <CardDescription>{t("session.authenticatedUserData")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div>
                    <p className="text-sm font-medium">{t("session.username")}</p>
                    <p className="text-sm text-muted-foreground">{user.username}</p>
                </div>
                <div>
                    <p className="text-sm font-medium">{t("session.role")}</p>
                    <p className="text-sm text-muted-foreground">{user.role}</p>
                </div>
            </CardContent>
        </Card>
    );
}
