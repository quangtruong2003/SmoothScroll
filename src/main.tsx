import React from "react";
import ReactDOM from "react-dom/client";
import i18n from "i18next";
import { listen } from "@tauri-apps/api/event";
import * as Sentry from "@sentry/browser";
import App from "./App";
import "./index.css";
import { initI18n, SUPPORTED_LANGS, type Lang } from "./i18n";
import { tauri } from "./lib/tauri";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IS_LINUX, IS_MAC, IS_WINDOWS } from "@/lib/platform";

// Set `body[data-platform]` so the stylesheet can apply platform-native
// tokens (fonts, colors, panel material, titlebar geometry). Windows
// keeps the default Tailwind look; macOS and Linux branch off via the
// selectors in index.css.
function tagPlatform() {
  const platform = IS_MAC ? "mac" : IS_LINUX ? "linux" : IS_WINDOWS ? "win" : "unknown";
  document.body.setAttribute("data-platform", platform);
}

// Initialize Sentry for crash reporting
function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  if (!dsn) {
    console.debug("[Sentry] Disabled (no VITE_SENTRY_DSN configured)");
    return;
  }

  Sentry.init({
    dsn,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });

  console.info("[Sentry] Initialized for crash reporting");
}

initSentry();
tagPlatform();

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
