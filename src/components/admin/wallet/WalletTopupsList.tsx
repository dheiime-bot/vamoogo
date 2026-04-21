import { useEffect, useMemo, useState } from "react";
import {
  History,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-warning/10 text-warning", icon: Clock },
  pago: { label: "Pago", color: "bg-primary/10 text-primary", icon: CheckCircle2 },
  creditado: { label: "Creditado", color: "bg-success/10 text-success", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  refreshKey?: number;
}

const WalletTopupsList = ({ refreshKey = 0 }: Props) => {
  const [topups, setTopups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async (p = page) => {
    setLoading(true);
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("wallet_topups")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    setTopups(data || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    load(0);
    setPage(0);
  }, [refreshKey]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-wallet-topups-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_topups" },
        () => load(page),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    const { data, error } = await supabase.rpc("admin_set_wallet_topup_status", {
      _topup_id: id,
      _new_status: status,
    });
    setUpdating(null);
    if (error) {
      toast.error(error.message || "Erro ao atualizar");
      return;
    }
    setTopups((current) => current.map((t) => (t.id === id ? { ...t, status } : t)));
    void load(page);
    const credited = Number((data as any)?.credited || 0);
    const bonus = Number((data as any)?.bonus || 0);
    if (credited > 0) {
      toast.success(
        `Saldo creditado: R$ ${formatBRL(credited)}` +
          (bonus > 0 ? ` + bônus R$ ${formatBRL(bonus)}` : ""),
      );
    } else {
      toast.success(`Status alterado para ${STATUS_LABELS[status]?.label || status}`);
    }
  };

  const rangeText = useMemo(() => {
    if (total === 0) return "0 registros";
    const from = page * PAGE_SIZE + 1;
    const to = Math.min(total, (page + 1) * PAGE_SIZE);
    return `${from}–${to} de ${total}`;
  }, [page, total]);

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="p-4 border-b flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-bold">Solicitações de recarga</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">{rangeText}</span>
      </div>

      <div className="divide-y min-h-[200px] relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!loading && topups.length === 0 && (
          <EmptyState
            icon={DollarSign}
            title="Nenhuma solicitação"
            description="As solicitações dos motoristas aparecerão aqui."
          />
        )}

        {topups.map((t) => {
          const meta = STATUS_LABELS[t.status] || STATUS_LABELS.pendente;
          const Icon = meta.icon;
          return (
            <div key={t.id} className="flex items-center gap-3 p-4">
              <div className={`rounded-xl p-2 ${meta.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {t.nome}{" "}
                  <span className="font-normal text-muted-foreground">
                    • R$ {formatBRL(Number(t.valor))}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t.telefone || "—"} • {new Date(t.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.color} hidden sm:inline-flex`}
              >
                {meta.label}
              </span>
              <select
                value={t.status}
                disabled={updating === t.id}
                onChange={(e) => updateStatus(t.id, e.target.value)}
                className="rounded-md border bg-background text-xs px-2 py-1"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="creditado">Creditado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          );
        })}
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between gap-2 p-3 border-t">
        <span className="text-[11px] text-muted-foreground">
          Página {page + 1} de {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WalletTopupsList;