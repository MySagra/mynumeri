import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { it } from "./locales/it";
import { en } from "./locales/en";

export const LANGUAGE_STORAGE_KEY = "app_lang";

function savedLanguage(): string {
  if (typeof window === "undefined") return "it";
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || "it";
  } catch {
    return "it";
  }
}

const resources = {
  it,
  en,
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    // Sul client parte già dalla lingua salvata; il provider non renderizza nulla
    // prima del mount, quindi non c'è mismatch di idratazione con il server.
    lng: savedLanguage(),
    fallbackLng: "it",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
