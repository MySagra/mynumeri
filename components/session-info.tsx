"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

/**
 * Example component showing how to use NextAuth session
 * This can be used as a reference for other components
 */
export function SessionInfo() {
    const { t } = useTranslation();
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t("session.loading")}</CardTitle>
                </CardHeader>
            </Card>
        );
    }

    if (!session) {
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
                    <p className="text-sm text-muted-foreground">{session.user.username}</p>
                </div>
                <div>
                    <p className="text-sm font-medium">{t("session.role")}</p>
                    <p className="text-sm text-muted-foreground">{session.user.role}</p>
                </div>
            </CardContent>
        </Card>
    );
}
