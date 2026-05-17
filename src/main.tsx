import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initI18n, type Lang } from "./i18n";
import { tauri } from "./lib/tauri";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

async function bootstrap() {
  let lang: Lang = "en";
  try {
    const settings = await tauri.getSettings();
    if (["en", "vi", "zh"].includes(settings.language)) {
      lang = settings.language as Lang;
    }
  } catch (e) {
    console.warn("getSettings failed at bootstrap; using en", e);
  }
  initI18n(lang);

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
