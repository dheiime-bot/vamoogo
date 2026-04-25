import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

if (!isPreviewHost && !isInIframe && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

// 🔄 Limpeza única de caches (executa 1x por dispositivo, controlada por versão).
// Bump CACHE_PURGE_VERSION para forçar nova limpeza global no próximo load.
const CACHE_PURGE_VERSION = "2026-04-20-1";
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
