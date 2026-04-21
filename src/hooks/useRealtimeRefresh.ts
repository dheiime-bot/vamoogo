import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe a uma ou mais tabelas e dispara `onChange()` em qualquer INSERT/UPDATE/DELETE.
 * Útil para manter listas do admin sempre vivas, sem refresh manual.
 */
export const useRealtimeRefresh = (
  tables: string | string[],
  onChange: () => void,
  channelName?: string
) => {
  useEffect(() => {
    const list = Array.isArray(tables) ? tables : [tables];
    const name = channelName || `rt-${list.join("-")}-${Math.random().toString(36).slice(2, 8)}`;
    let channel = supabase.channel(name);
    list.forEach((table) => {
      channel = channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => onChange()
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(tables) ? tables.join(",") : tables]);
};
