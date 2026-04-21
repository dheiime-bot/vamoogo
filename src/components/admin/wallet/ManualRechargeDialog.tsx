import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Wallet, User, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

interface DriverRow {
  user_id: string;
  full_name: string;
  phone: string | null;
  cpf: string | null;
  balance: number;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ManualRechargeDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<DriverRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DriverRow | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Recarga manual via admin");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setSelected(null);
      setAmount("");
      setReason("Recarga manual via admin");
    }
  }, [open]);

  // Busca debounced de motoristas (nome, cpf ou telefone)
  useEffect(() => {
    if (selected) return;
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase.rpc("admin_search_drivers", {
        _term: term,
        _limit: 10,
      });
      if (error) {
        console.error("[admin_search_drivers]", error);
        toast.error(error.message || "Erro ao buscar motoristas");
        setResults([]);
        setSearching(false);
        return;
      }
      setResults(
        (data || []).map((d: any) => ({
          user_id: d.user_id,
          full_name: d.full_name,
          phone: d.phone,
          cpf: d.cpf,
          balance: Number(d.balance) || 0,
        })),
      );
      setSearching(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, selected]);

  const numericAmount = useMemo(() => {
    const v = Number(amount.replace(/\./g, "").replace(",", "."));
    return isFinite(v) && v > 0 ? v : 0;
  }, [amount]);

  const handleConfirm = async () => {
    if (!selected) return;
    if (numericAmount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("admin_adjust_balance", {
      _driver_id: selected.user_id,
      _amount: numericAmount,
      _type: "add",
      _reason: reason || "Recarga manual via admin",
    });
    if (error) {
      console.error("[manual recharge]", error);
      setSubmitting(false);
      toast.error(error.message || "Erro ao creditar saldo");
      return;
    }

    // Registra também em wallet_topups como creditado, para histórico unificado
    await supabase.from("wallet_topups").insert({
      driver_id: selected.user_id,
      nome: selected.full_name,
      cpf: selected.cpf,
      telefone: selected.phone,
      valor: numericAmount,
      status: "creditado",
    });

    setSubmitting(false);
    toast.success(`R$ ${formatBRL(numericAmount)} creditados para ${selected.full_name}`);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            Recarga manual de motorista
          </DialogTitle>
          <DialogDescription>
            Busque o motorista e credite saldo diretamente na carteira.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Busca */}
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar motorista (nome, CPF ou telefone)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={selected ? selected.full_name : search}
                onChange={(e) => {
                  setSelected(null);
                  setSearch(e.target.value);
                }}
                placeholder="Digite ao menos 2 caracteres"
                className="pl-9"
              />
            </div>

            {!selected && search.trim().length >= 2 && (
              <div className="rounded-xl border bg-card max-h-64 overflow-auto divide-y">
                {searching ? (
                  <div className="p-4 flex items-center justify-center text-xs text-muted-foreground gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground text-center">
                    Nenhum motorista encontrado
                  </p>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.user_id}
                      type="button"
                      onClick={() => {
                        setSelected(r);
                        setSearch("");
                        setResults([]);
                      }}
                      className="w-full text-left p-3 hover:bg-muted/50 flex items-center gap-3 transition-colors"
                    >
                      <div className="rounded-full bg-muted p-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.full_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {r.cpf || "—"} • {r.phone || "—"}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-success whitespace-nowrap">
                        R$ {formatBRL(r.balance)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Motorista selecionado */}
          {selected && (
            <div className="rounded-xl border bg-success/5 border-success/30 p-3 flex items-center gap-3">
              <div className="rounded-full bg-success/15 p-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{selected.full_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Saldo atual: R$ {formatBRL(selected.balance)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Trocar
              </Button>
            </div>
          )}

          {/* Valor */}
          <div className="space-y-1.5">
            <Label className="text-xs">Valor a creditar (R$)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              disabled={!selected}
            />
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo / observação</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={300}
              disabled={!selected}
            />
          </div>

          {/* Resumo */}
          {selected && numericAmount > 0 && (
            <div className="rounded-xl bg-muted/40 p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Saldo atual</span>
                <span className="font-semibold">R$ {formatBRL(selected.balance)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">+ Crédito</span>
                <span className="font-semibold text-success">+ R$ {formatBRL(numericAmount)}</span>
              </div>
              <div className="border-t pt-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold">Novo saldo</span>
                <span className="text-base font-extrabold">
                  R$ {formatBRL(selected.balance + numericAmount)}
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={handleConfirm}
            disabled={submitting || !selected || numericAmount <= 0}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Wallet className="h-4 w-4 mr-2" />
                Creditar saldo
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualRechargeDialog;