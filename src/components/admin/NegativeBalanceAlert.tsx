/**
 * NegativeBalanceAlert — alerta no dashboard admin listando motoristas com saldo
 * negativo (após débito da taxa de plataforma da última corrida). Cada item leva
 * direto para a tela de motoristas com filtro pelo nome.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/brFormat";

type NegativeDriver = {
  user_id: string;
  balance: number;
  full_name: string | null;
  phone: string | null;
};

const NegativeBalanceAlert = () => {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<NegativeDriver[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: negatives } = await supabase
      .from("drivers")
      .select("user_id, balance")
      .lt("balance", 0)
      .order("balance", { ascending: true })
      .limit(50);

    if (!negatives || negatives.length === 0) {
      setDrivers([]);
      setLoading(false);
      return;
    }

    const ids = negatives.map((d) => d.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone")
      .in("user_id", ids);

    const merged: NegativeDriver[] = negatives.map((d) => {
      const p = profiles?.find((pp) => pp.user_id === d.user_id);
      return {
        user_id: d.user_id,
        balance: Number(d.balance),
        full_name: p?.full_name ?? null,
        phone: p?.phone ?? null,
      };
    });
    setDrivers(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-negative-drivers")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return null;
  if (drivers.length === 0) return null;

  const totalDebt = drivers.reduce((s, d) => s + Math.abs(d.balance), 0);

  return (
    <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-destructive/30 bg-destructive/10">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-destructive">
              Motoristas com saldo negativo
            </h3>
            <p className="text-[11px] text-destructive/80">
              {drivers.length} motorista{drivers.length > 1 ? "s" : ""} bloqueado{drivers.length > 1 ? "s" : ""} de aceitar corridas — débito total: {formatBRL(totalDebt)}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/admin/drivers")}
          className="text-xs font-semibold text-destructive hover:underline flex items-center gap-1"
        >
          Ver todos <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <ul className="divide-y divide-destructive/10 max-h-64 overflow-y-auto">
        {drivers.slice(0, 6).map((d) => (
          <li key={d.user_id}>
            <button
              onClick={() => navigate(`/admin/drivers?search=${encodeURIComponent(d.full_name || "")}`)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-destructive/5 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Wallet className="h-3.5 w-3.5 text-destructive shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {d.full_name || "Motorista sem nome"}
                  </p>
                  {d.phone && (
                    <p className="text-[11px] text-muted-foreground truncate">{d.phone}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-sm font-bold text-destructive tabular-nums">
                  {formatBRL(d.balance)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>
          </li>
        ))}
      </ul>

      {drivers.length > 6 && (
        <div className="px-4 py-2 bg-destructive/5 border-t border-destructive/10 text-center">
          <button
            onClick={() => navigate("/admin/drivers")}
            className="text-[11px] font-semibold text-destructive hover:underline"
          >
            +{drivers.length - 6} outro{drivers.length - 6 > 1 ? "s" : ""} motorista{drivers.length - 6 > 1 ? "s" : ""} negativo{drivers.length - 6 > 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
};

export default NegativeBalanceAlert;
