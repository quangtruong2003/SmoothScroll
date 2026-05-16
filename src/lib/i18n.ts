import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      app: {
        title: "Soft Scroll Next",
        enabled: "Enabled",
        disabled: "Disabled",
      },
      scroll: {
        title: "Scroll",
        stepSize: "Step size",
        animationTime: "Animation time",
        acceleration: "Acceleration",
        easing: "Animation easing",
        easingMode: "Easing curve",
        horizontalSmooth: "Smooth horizontal scroll",
        shiftHorizontal: "Shift + wheel = horizontal",
        reverse: "Reverse wheel direction",
      },
      startup: {
        title: "Startup",
        startWithOs: "Start with OS",
        startMinimized: "Start minimized",
      },
      general: {
        title: "General",
        language: "Language",
        hotkey: "Global hotkey",
        trayIcon: "Show tray icon",
      },
      exclusions: {
        title: "Excluded Applications",
        add: "Add application",
        empty: "No excluded applications",
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
