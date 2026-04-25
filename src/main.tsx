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

const APP_REFRESH_VERSION = "2026-04-25-sw-hard-refresh-2";

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

if (!isPreviewHost && !isInIframe && "serviceWorker" in navigator) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    reloadWithoutCache();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`, { updateViaCache: "none" });

      const checkForUpdate = async () => {
        try {
          await registration.update();
          activateUpdatedServiceWorker(registration.waiting);
        } catch {
          // ignora falhas temporárias de atualização
        }
      };

      registration.addEventListener("updatefound", () => {
        const nextWorker = registration.installing;
        nextWorker?.addEventListener("statechange", () => {
          if (nextWorker.state === "installed") {
            activateUpdatedServiceWorker(nextWorker);
          }
        });
      });

      await checkForUpdate();
      window.setInterval(checkForUpdate, 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("focus", checkForUpdate);
      window.addEventListener("online", checkForUpdate);
    } catch {
      // ignora erros do service worker
    }
  });
}

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
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      localStorage.setItem("vamoo_cache_purge", CACHE_PURGE_VERSION);
    }
  } catch {
    // ignora erros de cache
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
