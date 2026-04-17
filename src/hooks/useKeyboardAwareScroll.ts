import { useEffect } from "react";

/**
 * Garante que o input/textarea focado fique visível acima do teclado virtual no mobile.
 *
 * Estratégia:
 * 1. Em browsers que suportam `visualViewport`, escutamos `resize` para detectar a
 *    abertura do teclado e rolamos o elemento ativo para a área visível.
 * 2. Como reforço, escutamos `focusin` em campos de formulário e damos um pequeno
 *    delay (~280ms) antes de chamar `scrollIntoView({ block: "center" })` —
 *    tempo suficiente para o teclado terminar de subir.
 *
 * Usamos `block: "center"` para empurrar o campo para o meio da viewport visível
 * (e não para o topo), garantindo que rótulo + dicas continuem aparecendo acima do teclado.
 */
export function useKeyboardAwareScroll() {
  useEffect(() => {
    const isFormField = (el: Element | null): el is HTMLElement => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const scrollFocusedIntoView = () => {
      const el = document.activeElement;
      if (!isFormField(el)) return;
      setTimeout(() => {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          el.scrollIntoView();
        }
      }, 280);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isFormField(e.target as Element)) scrollFocusedIntoView();
    };

    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const onViewportResize = () => scrollFocusedIntoView();

    document.addEventListener("focusin", onFocusIn);
    vv?.addEventListener("resize", onViewportResize);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      vv?.removeEventListener("resize", onViewportResize);
    };
  }, []);
}
