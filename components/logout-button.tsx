"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { logout as logoutAction } from "@/actions/auth";
import { USER_STORAGE_KEY } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function LogoutButton() {
    const { t } = useTranslation();
    const handleLogout = async () => {
        try {
            await logoutAction();
            toast.success(t("session.logoutSuccess"));
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            localStorage.removeItem(USER_STORAGE_KEY);
            window.location.href = "/";
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
        >
            <LogOut className="h-4 w-4" />
            {t("session.logout")}
        </Button>
    );
}
