import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BeforeInstallPromptEvent, storeInstallPrompt } from "./lib/pwaInstall";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const APP_REFRESH_VERSION = "2026-04-25-published-cache-bust-v5";

const buildCacheBustedUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.set("vamoo_v", APP_REFRESH_VERSION);
  url.searchParams.set("t", Date.now().toString());
  return url.toString();
};

const reloadWithoutCache = async () => {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // ignora falhas temporárias de cache
  }
  window.location.replace(buildCacheBustedUrl());
};

const activateUpdatedServiceWorker = (worker?: ServiceWorker | null) => {
  if (!worker) return;
  worker.postMessage({ type: "SKIP_WAITING" });
};

const removeServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  storeInstallPrompt(event as BeforeInstallPromptEvent);
});

// 🔄 Limpeza única de caches (executa 1x por dispositivo, controlada por versão).
// Bump CACHE_PURGE_VERSION para forçar nova limpeza global no próximo load.
const CACHE_PURGE_VERSION = APP_REFRESH_VERSION;
(async () => {
  try {
    if (localStorage.getItem("vamoo_cache_purge") !== CACHE_PURGE_VERSION) {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ((isPreviewHost || isInIframe) && "serviceWorker" in navigator) {
        await removeServiceWorkers();
      }
      if (!isPreviewHost && !isInIframe) await removeServiceWorkers();
      localStorage.setItem("vamoo_cache_purge", CACHE_PURGE_VERSION);
    }
  } catch {
    // ignora erros de cache
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
