import { useEffect, useState } from "react";
import { Save, Loader2, MessageCircle, Plus, X, History, CheckCircle2, Clock, XCircle, DollarSign, Gift, Trash2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsappTopupConfig {
  enabled: boolean;
  whatsapp_number: string;
  central_name: string;
  message_template: string;
  quick_amounts: number[];
  allow_custom_amount: boolean;
  bonus_enabled: boolean;
  bonus_tiers: { min_amount: number; percent: number }[];
}

const DEFAULT_CONFIG: WhatsappTopupConfig = {
  enabled: false,
  whatsapp_number: "",
  central_name: "Central Vamoo",
  message_template:
    "Olá, gostaria de solicitar uma recarga para minha carteira de motorista.\n\nNome: {nome}\nCPF: {cpf}\nTelefone: {telefone}\nID do motorista: {id}\nValor da recarga: R$ {valor}",
  quick_amounts: [20, 30, 50, 100],
  allow_custom_amount: true,
  bonus_enabled: true,
  bonus_tiers: [
    { min_amount: 100, percent: 5 },
    { min_amount: 150, percent: 10 },
    { min_amount: 200, percent: 15 },
  ],
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-warning/10 text-warning", icon: Clock },
  pago: { label: "Pago", color: "bg-primary/10 text-primary", icon: CheckCircle2 },
  creditado: { label: "Creditado", color: "bg-success/10 text-success", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

const AdminWalletTopup = () => {
  const [config, setConfig] = useState<WhatsappTopupConfig>(DEFAULT_CONFIG);
  const [newAmount, setNewAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topups, setTopups] = useState<any[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "whatsapp_topup")
      .maybeSingle();
    if (data?.value) {
      setConfig({ ...DEFAULT_CONFIG, ...(data.value as any) });
    }
    setLoading(false);
  };

  const loadTopups = async () => {
    const { data } = await supabase
      .from("wallet_topups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setTopups(data || []);
  };

  useEffect(() => {
    loadConfig();
    loadTopups();
    const ch = supabase
      .channel("admin-wallet-topups")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_topups" }, loadTopups)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const save = async () => {
    if (config.enabled && !config.whatsapp_number.trim()) {
      toast.error("Informe o número do WhatsApp para ativar");
      return;
    }
    setSaving(true);
    const cleaned = {
      ...config,
      whatsapp_number: config.whatsapp_number.replace(/\D/g, ""),
      quick_amounts: [...config.quick_amounts].sort((a, b) => a - b),
    };
    const { error } = await supabase
      .from("platform_settings")
      .upsert(
        { key: "whatsapp_topup", value: cleaned as any, description: "Configuração de recarga via WhatsApp" },
        { onConflict: "key" },
      );
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar configuração");
      return;
    }
    setConfig(cleaned);
    toast.success("Configuração salva!");
  };

  const addAmount = () => {
    const v = Number(newAmount.replace(",", "."));
    if (!v || v <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (config.quick_amounts.includes(v)) {
      toast.error("Valor já existe");
      return;
    }
    setConfig({ ...config, quick_amounts: [...config.quick_amounts, v].sort((a, b) => a - b) });
    setNewAmount("");
  };

  const removeAmount = (v: number) => {
    setConfig({ ...config, quick_amounts: config.quick_amounts.filter((x) => x !== v) });
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    const { error } = await supabase.from("wallet_topups").update({ status }).eq("id", id);
    setUpdating(null);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success(`Status alterado para ${STATUS_LABELS[status]?.label || status}`);
  };

  if (loading) {
    return (
      <AdminLayout title="Recarga de Carteira">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Recarga de Carteira"
      actions={
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span className="ml-1.5">Salvar</span>
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Toggle ativar */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-success/10 p-2.5">
                <MessageCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Recarga via WhatsApp</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permite que motoristas solicitem recargas direto pela central de atendimento
                </p>
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
            />
          </div>
        </div>

        {/* Dados da central */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold">Central de atendimento</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da central</Label>
              <Input
                value={config.central_name}
                onChange={(e) => setConfig({ ...config, central_name: e.target.value })}
                placeholder="Ex.: Central Vamoo"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Número WhatsApp (com DDI/DDD, só dígitos)</Label>
              <Input
                value={config.whatsapp_number}
                onChange={(e) =>
                  setConfig({ ...config, whatsapp_number: e.target.value.replace(/\D/g, "") })
                }
                placeholder="559999999999"
                inputMode="numeric"
                maxLength={15}
              />
              <p className="text-[10px] text-muted-foreground">
                Formato internacional, sem +, espaços ou traços. Ex: 5511987654321
              </p>
            </div>
          </div>
        </div>

        {/* Mensagem padrão */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-bold">Mensagem padrão</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Variáveis disponíveis: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{"{nome}"}</code>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{"{cpf}"}</code>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{"{telefone}"}</code>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{"{id}"}</code>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{"{valor}"}</code>
            </p>
          </div>
          <Textarea
            value={config.message_template}
            onChange={(e) => setConfig({ ...config, message_template: e.target.value })}
            rows={8}
            maxLength={1500}
            className="font-mono text-xs"
          />
        </div>

        {/* Valores rápidos */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold">Valores rápidos</h3>
          <div className="flex flex-wrap gap-2">
            {config.quick_amounts.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
              >
                R$ {v}
                <button
                  onClick={() => removeAmount(v)}
                  className="rounded-full hover:bg-destructive/20 p-0.5"
                  aria-label={`Remover R$ ${v}`}
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>
              </span>
            ))}
            {config.quick_amounts.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum valor cadastrado</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Input
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAmount())}
              placeholder="Ex.: 50"
              inputMode="decimal"
              className="max-w-[140px]"
            />
            <Button onClick={addAmount} size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div>
              <p className="text-xs font-semibold">Permitir valor personalizado</p>
              <p className="text-[11px] text-muted-foreground">
                Motorista pode digitar um valor diferente dos rápidos
              </p>
            </div>
            <Switch
              checked={config.allow_custom_amount}
              onCheckedChange={(v) => setConfig({ ...config, allow_custom_amount: v })}
            />
          </div>
        </div>

        {/* Histórico de solicitações */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Solicitações de recarga</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">{topups.length} registros</span>
          </div>
          <div className="divide-y">
            {topups.length === 0 && (
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
                        • R$ {Number(t.valor).toFixed(2).replace(".", ",")}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.telefone || "—"} • {new Date(t.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
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
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminWalletTopup;