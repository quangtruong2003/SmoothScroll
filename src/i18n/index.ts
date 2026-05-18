import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import vi from "./locales/vi.json";
import zh from "./locales/zh.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import hi from "./locales/hi.json";
import id from "./locales/id.json";
import it from "./locales/it.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ptBR from "./locales/pt-BR.json";
import es from "./locales/es.json";
import tr from "./locales/tr.json";
import ru from "./locales/ru.json";

export const SUPPORTED_LANGS = [
  "en",
  "vi",
  "zh",
  "fr",
  "de",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "pt-BR",
  "es",
  "tr",
  "ru",
] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export function initI18n(initialLang: Lang) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
      zh: { translation: zh },
      fr: { translation: fr },
      de: { translation: de },
      hi: { translation: hi },
      id: { translation: id },
      it: { translation: it },
      ja: { translation: ja },
      ko: { translation: ko },
      "pt-BR": { translation: ptBR },
      es: { translation: es },
      tr: { translation: tr },
      ru: { translation: ru },
    },
    lng: initialLang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export function setLanguage(lang: Lang) {
  void i18n.changeLanguage(lang);
}
