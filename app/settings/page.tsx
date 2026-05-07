"use client";

import { SettingsHeader } from "@/components/settings/header";
import { AppearanceSettingsCard } from "@/components/settings/AppearanceSettingsCard";
import { GeneralSettingsCard } from "@/components/settings/GeneralSettingsCard";
import { DisplayModeSettingsCard } from "@/components/settings/DisplayModeSettingsCard";
import { NumberDisplaySettingsCard } from "@/components/settings/NumberDisplaySettingsCard";
import { StationsSettingsCard } from "@/components/settings/StationsSettingsCard";

export default function SettingsPage() {
    return (
        <>
            <SettingsHeader />
            <main className="min-h-screen w-full bg-background">
                <div className="max-w-4xl mx-auto p-6 pt-24 space-y-6">
                    <GeneralSettingsCard />
                    <DisplayModeSettingsCard />
                    <NumberDisplaySettingsCard />
                    <StationsSettingsCard />
                    <AppearanceSettingsCard />
                </div>
            </main>
        </>
    );
}
