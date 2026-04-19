import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Blindagem global do realtime.
 *
 * O Supabase Realtime usa WebSocket. Em alguns cenários a conexão pode ficar
 * "presa" sem disparar eventos, mesmo após o cliente voltar a ficar ativo:
 *  - Aba em background por muito tempo (browser suspende sockets)
 *  - Computador entrou em sleep / hibernação
 *  - Internet caiu e voltou
 *  - Mudança de rede (Wi-Fi → 4G)
 *
 * Este hook escuta `visibilitychange` e `online`, e quando detecta que voltamos
 * a estar ativos, força o realtime a se reconectar (`disconnect()` + `connect()`).
 * Os canais já inscritos se re-subscrevem automaticamente após o reconnect.
 *
 * Use uma única vez no <App />. Não precisa de props.
 */
export const useRealtimeReconnect = () => {
  useEffect(() => {
    const reconnect = () => {
      try {
        // Reconecta o socket — canais existentes se re-inscrevem sozinhos.
        // @ts-expect-error métodos internos expostos pelo client
        supabase.realtime?.disconnect?.();
        // @ts-expect-error métodos internos expostos pelo client
        supabase.realtime?.connect?.();
      } catch (err) {
        console.warn("[realtime] reconnect failed", err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") reconnect();
    };
    const onOnline = () => reconnect();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);
};
