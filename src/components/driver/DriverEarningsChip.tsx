/**
 * DriverEarningsChip — chip flutuante no canto superior DIREITO do app do motorista
 * mostrando o saldo de ganhos do dia. Clicando, leva para a Carteira.
 * Fica acima do sino de notificações e do botão de atualizar.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/brFormat";

const DriverEarningsChip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [earnings, setEarnings] = useState(0);

  const reload = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("rides")
      .select("driver_net")
      .eq("driver_id", user.id)
      .eq("status", "completed")
      .gte("completed_at", today);
    if (data) {
      setEarnings(data.reduce((s, r: any) => s + Number(r.driver_net || 0), 0));
    }
  };

  useEffect(() => {
    if (!user) return;
    reload();
    const channel = supabase
      .channel(`driver-earnings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `driver_id=eq.${user.id}` },
        reload,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <button
      onClick={() => navigate("/driver/wallet")}
      className="fixed right-3 z-50 flex h-16 items-center gap-2 rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border px-5 transition-transform active:scale-95 hover:bg-muted"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      aria-label="Ver carteira"
    >
      <span className="font-display text-lg font-extrabold text-gradient-primary leading-none select-none">
        {formatBRL(earnings)}
      </span>
    </button>
  );
};

export default DriverEarningsChip;
