import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe a uma ou mais tabelas e dispara `onChange()` em qualquer INSERT/UPDATE/DELETE.
 * Útil para manter listas do admin sempre vivas, sem refresh manual.
 *
 * IMPORTANTE: o nome do canal precisa conter o uid do usuário autenticado
 * (a política RLS de realtime.messages exige isso).
 */
export const useRealtimeRefresh = (
  tables: string | string[],
  onChange: () => void,
  channelName?: string
) => {
  useEffect(() => {
    const list = Array.isArray(tables) ? tables : [tables];
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const base = channelName || `rt-${list.join("-")}`;
      const name = `${base}-${user.id}-${Math.random().toString(36).slice(2, 8)}`;
      channel = supabase.channel(name);
    list.forEach((table) => {
        channel = channel!.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => onChange()
      );
    });
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(tables) ? tables.join(",") : tables]);
};
