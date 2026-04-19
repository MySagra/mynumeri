"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

export function SettingsHeader() {
    const router = useRouter();
    const { t } = useTranslation();

    return (
        <header className="border-b fixed top-0 z-10 flex h-16 w-full items-center justify-between bg-card px-4 shadow-sm">
            <div className="flex items-center gap-3">
                <img
                    src="/logo.svg"
                    alt="Logo"
                    className="mx-auto h-10 w-auto select-none"
                />
                <h1 className="text-2xl font-bold select-none hidden md:block">{t("settings.settings")}</h1>
            </div>
            <Button variant="outline" onClick={() => router.push("/manager")}>
                <ArrowLeft className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">{t("settings.backToManager")}</span>
            </Button>
        </header>
    );
}
