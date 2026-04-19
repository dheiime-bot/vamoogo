/**
 * PassengerSpendChip — chip flutuante no canto superior DIREITO do app do passageiro.
 * Mostra o TOTAL GASTO GERAL (todas as corridas concluídas). Clicar leva ao histórico.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/brFormat";

const PassengerSpendChip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [spent, setSpent] = useState(0);

  const reload = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rides")
      .select("price")
      .eq("passenger_id", user.id)
      .eq("status", "completed");
    if (data) {
      setSpent(data.reduce((s, r: any) => s + Number(r.price || 0), 0));
    }
  };

  useEffect(() => {
    if (!user) return;
    reload();
    const channel = supabase
      .channel(`passenger-spend-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `passenger_id=eq.${user.id}` },
        reload,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <button
      onClick={() => navigate("/passenger/history")}
      className="fixed right-3 z-50 flex h-16 items-center gap-2 rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border px-5 transition-transform active:scale-95 hover:bg-muted"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      aria-label="Ver histórico de corridas"
    >
      <span className="font-display text-lg font-extrabold text-gradient-primary leading-none select-none">
        {formatBRL(spent)}
      </span>
    </button>
  );
};

export default PassengerSpendChip;
