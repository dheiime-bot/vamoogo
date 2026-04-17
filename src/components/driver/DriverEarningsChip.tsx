/**
 * DriverEarningsChip — chip flutuante no topo do app do motorista
 * mostrando o saldo de ganhos do dia. Clicando, leva para a Carteira.
 * Posicionado entre o menu (esquerda) e o sino (direita).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/brFormat";

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
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-full bg-card/95 backdrop-blur-md border border-border shadow-lg px-3.5 py-2 hover:scale-105 active:scale-95 transition-transform"
      aria-label="Ver carteira"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hoje</span>
      <span className="text-sm font-extrabold text-primary">{brl(earnings)}</span>
    </button>
  );
};

export default DriverEarningsChip;
