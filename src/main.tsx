import React from "react";
import ReactDOM from "react-dom/client";
import i18n from "i18next";
import { listen } from "@tauri-apps/api/event";
import App from "./App";
import "./index.css";
import { initI18n, SUPPORTED_LANGS, type Lang } from "./i18n";
import { tauri } from "./lib/tauri";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

async function bootstrap() {
  let lang: Lang = "en";
  try {
    const settings = await tauri.getSettings();
    if (SUPPORTED_LANGS.includes(settings.language as Lang)) {
      lang = settings.language as Lang;
    }
  } catch (e) {
    console.warn("getSettings failed at bootstrap; using en", e);
  }
  initI18n(lang);

  // Backend emits "language-changed" whenever language is updated (from any
  // window). Listen here so secondary windows like the tray panel re-render
  // in the new language without needing a reload.
  void listen<string>("language-changed", (event) => {
    const next = event.payload;
    if (SUPPORTED_LANGS.includes(next as Lang) && i18n.language !== next) {
      void i18n.changeLanguage(next);
    }
  });

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <TooltipProvider>
        <App />
        <Toaster />
      </TooltipProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
