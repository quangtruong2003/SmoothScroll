import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import vi from "./locales/vi.json";
import zh from "./locales/zh.json";

export const SUPPORTED_LANGS = ["en", "vi", "zh"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export function initI18n(initialLang: Lang) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
      zh: { translation: zh },
    },
    lng: initialLang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export function setLanguage(lang: Lang) {
  void i18n.changeLanguage(lang);
}
