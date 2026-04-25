export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __vamooInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export const VAMOO_INSTALL_PROMPT_READY = "vamoo-install-prompt-ready";

export const getStoredInstallPrompt = () => window.__vamooInstallPrompt || null;

export const storeInstallPrompt = (event: BeforeInstallPromptEvent) => {
  window.__vamooInstallPrompt = event;
  window.dispatchEvent(new Event(VAMOO_INSTALL_PROMPT_READY));
};

export const clearStoredInstallPrompt = () => {
  window.__vamooInstallPrompt = null;
};