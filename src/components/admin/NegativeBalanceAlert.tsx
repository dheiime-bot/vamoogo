/**
 * NegativeBalanceAlert — alerta no dashboard admin listando motoristas com saldo
 * negativo (após débito da taxa de plataforma da última corrida). Cada item leva
 * direto para a tela de motoristas com filtro pelo nome.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, Wallet, Send, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/brFormat";
import { toast } from "sonner";

type NegativeDriver = {
  user_id: string;
  balance: number;
  full_name: string | null;
  phone: string | null;
  days_remaining: number | null;
  last_alert_at: string | null;
  blocked_at: string | null;
};

const NegativeBalanceAlert = () => {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<NegativeDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [runningBatch, setRunningBatch] = useState(false);

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
    const [{ data: profiles }, { data: alerts }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, phone").in("user_id", ids),
      supabase
        .from("negative_balance_alerts")
        .select("driver_id, days_remaining, last_alert_at, blocked_at, resolved_at")
        .in("driver_id", ids),
    ]);

    const merged: NegativeDriver[] = negatives.map((d) => {
      const p = profiles?.find((pp) => pp.user_id === d.user_id);
      const a = alerts?.find((aa) => aa.driver_id === d.user_id && !aa.resolved_at);
      return {
        user_id: d.user_id,
        balance: Number(d.balance),
        full_name: p?.full_name ?? null,
        phone: p?.phone ?? null,
        days_remaining: a?.days_remaining ?? null,
        last_alert_at: a?.last_alert_at ?? null,
        blocked_at: a?.blocked_at ?? null,
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "negative_balance_alerts" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendManualAlert = async (driverId: string, name: string) => {
    setSendingId(driverId);
    const { error } = await supabase.rpc("admin_send_negative_balance_alert", {
      _driver_id: driverId,
    });
    setSendingId(null);
    if (error) {
      toast.error(error.message || "Erro ao enviar cobrança");
      return;
    }
    toast.success(`Cobrança enviada para ${name}`);
    load();
  };

  const runBatchNow = async () => {
    if (!confirm("Executar agora a cobrança automática diária? Isso decrementa 1 dia do contador de cada motorista negativo e bloqueia quem chegou a 0.")) return;
    setRunningBatch(true);
    const { data, error } = await supabase.rpc("process_negative_balance_alerts");
    setRunningBatch(false);
    if (error) {
      toast.error(error.message || "Erro ao processar cobranças");
      return;
    }
    const result = data as { processed: number; blocked: number; resolved: number };
    toast.success(
      `Processadas: ${result.processed} • Bloqueadas: ${result.blocked} • Regularizadas: ${result.resolved}`,
    );
    load();
  };

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
        <div className="flex items-center gap-2">
          <button
            onClick={runBatchNow}
            disabled={runningBatch}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 flex items-center gap-1"
            title="Executar cobrança diária agora (decrementa contador)"
          >
            {runningBatch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Executar diária
          </button>
          <button
            onClick={() => navigate("/admin/drivers")}
            className="text-xs font-semibold text-destructive hover:underline flex items-center gap-1"
          >
            Ver todos <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <ul className="divide-y divide-destructive/10 max-h-64 overflow-y-auto">
        {drivers.slice(0, 6).map((d) => (
          <li key={d.user_id}>
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-destructive/5 transition-colors">
              <button
                onClick={() => navigate(`/admin/drivers?search=${encodeURIComponent(d.full_name || "")}`)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left"
              >
                <Wallet className="h-3.5 w-3.5 text-destructive shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {d.full_name || "Motorista sem nome"}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {d.phone && (
                      <span className="text-[11px] text-muted-foreground truncate">{d.phone}</span>
                    )}
                    {d.blocked_at ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">
                        BLOQUEADO
                      </span>
                    ) : d.days_remaining !== null ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          d.days_remaining <= 7
                            ? "bg-destructive/20 text-destructive"
                            : d.days_remaining <= 15
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {d.days_remaining}d restantes
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        sem cobrança
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-sm font-bold text-destructive tabular-nums">
                  {formatBRL(d.balance)}
                </span>
                {!d.blocked_at && (
                  <button
                    onClick={() => sendManualAlert(d.user_id, d.full_name || "motorista")}
                    disabled={sendingId === d.user_id}
                    className="h-7 w-7 rounded-lg bg-destructive/15 hover:bg-destructive/25 text-destructive flex items-center justify-center disabled:opacity-50"
                    title="Enviar cobrança agora"
                  >
                    {sendingId === d.user_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
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
