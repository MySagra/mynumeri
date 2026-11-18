"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { LANGUAGE_STORAGE_KEY } from "./i18n";
import { useMounted } from "@/hooks/use-mounted";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // La lingua salvata è già applicata all'inizializzazione di i18n (lib/i18n/i18n.ts)
  const mounted = useMounted();

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      try { localStorage.setItem(LANGUAGE_STORAGE_KEY, lng); } catch { /* localStorage non disponibile */ }
    };

    i18n.on("languageChanged", handleLanguageChange);
    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, []);

  // Nothing until mounted, so the client language never mismatches the server render
  if (!mounted) {
    return null;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
