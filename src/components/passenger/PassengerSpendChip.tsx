/**
 * PassengerSpendChip — chip flutuante no canto superior DIREITO do app do passageiro.
 * Mostra o TOTAL GASTO GERAL (todas as corridas concluídas). Clicar leva ao histórico.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/brFormat";

const PassengerSpendChip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [spent, setSpent] = useState(0);
  const [hidden, setHidden] = useState(false);

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
    setHidden(localStorage.getItem(`passenger-spend-hidden-${user.id}`) === "1");
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

  const toggleHidden = () => {
    if (!user) return;
    const next = !hidden;
    setHidden(next);
    localStorage.setItem(`passenger-spend-hidden-${user.id}`, next ? "1" : "0");
  };

  return (
    <div
      className="fixed right-3 z-50 flex h-16 items-center gap-2 rounded-full bg-card/95 backdrop-blur-md shadow-md border border-border px-2 pl-5"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <button onClick={() => navigate("/passageiro/history")} className="font-display text-lg font-extrabold text-foreground leading-none select-none" aria-label="Ver histórico de corridas">
        {hidden ? "R$ •••" : formatBRL(spent)}
      </button>
      <button onClick={toggleHidden} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label={hidden ? "Mostrar valor" : "Ocultar valor"}>
        {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
};

export default PassengerSpendChip;
