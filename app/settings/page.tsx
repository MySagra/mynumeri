"use client";

import { SettingsHeader } from "@/components/settings/header";
import { AppearanceSettingsCard } from "@/components/settings/AppearanceSettingsCard";
import { GeneralSettingsCard } from "@/components/settings/GeneralSettingsCard";
import { DisplayModeSettingsCard } from "@/components/settings/DisplayModeSettingsCard";

export default function SettingsPage() {
    return (
        <>
            <SettingsHeader />
            <main className="min-h-screen w-full bg-background">
                <div className="mx-auto max-w-4xl space-y-5 px-4 pb-10 pt-24 sm:px-6">
                    <GeneralSettingsCard />
                    <DisplayModeSettingsCard />
                    <AppearanceSettingsCard />
                </div>
            </main>
        </>
    );
}
