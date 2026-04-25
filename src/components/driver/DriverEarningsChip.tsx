/**
 * DriverEarningsChip — chip flutuante no canto superior DIREITO do app do motorista
 * mostrando o saldo de ganhos do dia. Clicando, leva para a Carteira.
 * Fica acima do sino de notificações e do botão de atualizar.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/brFormat";

const DriverEarningsChip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [earnings, setEarnings] = useState(0);
  const [hidden, setHidden] = useState(false);

  const getLocalDayStartIso = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  };

  const msUntilNextLocalMidnight = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
  };

  const reload = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rides")
      .select("driver_net")
      .eq("driver_id", user.id)
      .eq("status", "completed")
      .gte("completed_at", getLocalDayStartIso());
    if (data) {
      setEarnings(data.reduce((s, r: any) => s + Number(r.driver_net || 0), 0));
    }
  };

  useEffect(() => {
    if (!user) return;
    setHidden(localStorage.getItem(`driver-earnings-hidden-${user.id}`) === "1");
    reload();
    const channel = supabase
      .channel(`driver-earnings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `driver_id=eq.${user.id}` },
        reload,
      )
      .subscribe();
    const midnightTimer = window.setTimeout(reload, msUntilNextLocalMidnight() + 1000);
    return () => {
      window.clearTimeout(midnightTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleHidden = () => {
    if (!user) return;
    const next = !hidden;
    setHidden(next);
    localStorage.setItem(`driver-earnings-hidden-${user.id}`, next ? "1" : "0");
  };

  return (
    <div
      className="fixed right-3 z-50 flex h-16 items-center gap-2 rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border px-2 pl-5"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <button onClick={() => navigate("/motorista/wallet")} className="font-display text-lg font-extrabold text-foreground leading-none select-none" aria-label="Ver carteira">
        {hidden ? "R$ •••" : formatBRL(earnings)}
      </button>
      <button onClick={toggleHidden} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label={hidden ? "Mostrar valor" : "Ocultar valor"}>
        {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
};

export default DriverEarningsChip;
