"use client";

import { ThemeProvider } from '@teispace/next-themes';
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <I18nProvider>{children}</I18nProvider>
            <Toaster position="top-center" richColors />
        </ThemeProvider>
    );
}
