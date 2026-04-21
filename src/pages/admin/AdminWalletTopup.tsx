import { useEffect, useState } from "react";
import { Save, Loader2, MessageCircle, Plus, X, Gift, Trash2, Wallet, AlertCircle, CheckCircle2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ManualRechargeDialog from "@/components/admin/wallet/ManualRechargeDialog";
import WalletTopupsList from "@/components/admin/wallet/WalletTopupsList";

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

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Aplica máscara visual BR: +55 (11) 98765-4321
const formatPhoneBR = (digitsOnly: string) => {
  const d = digitsOnly.replace(/\D/g, "").slice(0, 13);
  if (d.length === 0) return "";
  // Garante DDI 55 quando o usuário começa a digitar só DDD
  const withDdi = d.startsWith("55") ? d : (d.length > 2 ? `55${d}` : d);
  const ddi = withDdi.slice(0, 2);
  const ddd = withDdi.slice(2, 4);
  const part1 = withDdi.slice(4, 9);
  const part2 = withDdi.slice(9, 13);
  let out = `+${ddi}`;
  if (ddd) out += ` (${ddd})`;
  if (part1) out += ` ${part1}`;
  if (part2) out += `-${part2}`;
  return out;
};

const normalizeWhatsappBR = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return digits.length >= 10 ? `55${digits}`.slice(0, 13) : digits;
};

const AdminWalletTopup = () => {
  const [config, setConfig] = useState<WhatsappTopupConfig>(DEFAULT_CONFIG);
  const [newAmount, setNewAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [refreshList, setRefreshList] = useState(0);

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

  useEffect(() => {
    loadConfig();
  }, []);

  const save = async () => {
    const digits = normalizeWhatsappBR(config.whatsapp_number);
    if (config.enabled && !/^55\d{10,11}$/.test(digits)) {
      toast.error("Informe um WhatsApp do Brasil válido com DDD e número");
      return;
    }
    setSaving(true);
    const cleaned: WhatsappTopupConfig = {
      ...config,
      whatsapp_number: digits,
      quick_amounts: [...config.quick_amounts].sort((a, b) => a - b),
      bonus_tiers: [...(config.bonus_tiers || [])]
        .filter((t) => t.min_amount > 0 && t.percent > 0)
        .sort((a, b) => a.min_amount - b.min_amount),
    };

    // Atualiza se existir, senão insere — evita problemas de upsert/RLS
    const { data: existing } = await supabase
      .from("platform_settings")
      .select("id")
      .eq("key", "whatsapp_topup")
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("platform_settings")
        .update({ value: cleaned as any, description: "Configuração de recarga via WhatsApp" })
        .eq("key", "whatsapp_topup"));
    } else {
      ({ error } = await supabase
        .from("platform_settings")
        .insert({ key: "whatsapp_topup", value: cleaned as any, description: "Configuração de recarga via WhatsApp" }));
    }

    setSaving(false);
    if (error) {
      console.error("[wallet-topup save]", error);
      toast.error(error.message || "Erro ao salvar configuração");
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

  const addTier = () => {
    setConfig({
      ...config,
      bonus_tiers: [...(config.bonus_tiers || []), { min_amount: 0, percent: 0 }],
    });
  };

  const updateTier = (i: number, patch: Partial<{ min_amount: number; percent: number }>) => {
    const next = [...(config.bonus_tiers || [])];
    next[i] = { ...next[i], ...patch };
    setConfig({ ...config, bonus_tiers: next });
  };

  const removeTier = (i: number) => {
    setConfig({
      ...config,
      bonus_tiers: (config.bonus_tiers || []).filter((_, idx) => idx !== i),
    });
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
        <div className="flex items-center gap-2">
          <Button onClick={() => setManualOpen(true)} size="sm" variant="outline">
            <Wallet className="h-3.5 w-3.5" />
            <span className="ml-1.5">Recarga manual</span>
          </Button>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Salvar</span>
          </Button>
        </div>
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
                value={formatPhoneBR(config.whatsapp_number)}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 13);
                  setConfig({ ...config, whatsapp_number: d });
                }}
                placeholder="+55 (11) 98765-4321"
                inputMode="tel"
                maxLength={22}
              />
              <p className="text-[10px] text-muted-foreground">
                Formato Brasil: digite DDD + número, o +55 é adicionado automaticamente. Ex.: 11987654321
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
                R$ {formatBRL(v)}
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

        {/* Bônus por faixa */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Bônus de recarga</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ofereça um percentual extra a partir de certos valores. A faixa de maior valor que o motorista atingir será aplicada.
                </p>
              </div>
            </div>
            <Switch
              checked={config.bonus_enabled}
              onCheckedChange={(v) => setConfig({ ...config, bonus_enabled: v })}
            />
          </div>

          <div className="space-y-2">
            {(config.bonus_tiers || []).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma faixa cadastrada.</p>
            )}
            {(config.bonus_tiers || []).map((t, i) => (
              <div key={i} className="flex items-end gap-2 rounded-xl border bg-muted/30 p-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">A partir de (R$)</Label>
                  <Input
                    value={t.min_amount || ""}
                    onChange={(e) => updateTier(i, { min_amount: Number(e.target.value.replace(",", ".")) || 0 })}
                    placeholder="100"
                    inputMode="decimal"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Bônus (%)</Label>
                  <Input
                    value={t.percent || ""}
                    onChange={(e) => updateTier(i, { percent: Number(e.target.value.replace(",", ".")) || 0 })}
                    placeholder="5"
                    inputMode="decimal"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTier(i)}
                  className="text-destructive hover:bg-destructive/10"
                  aria-label="Remover faixa"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button onClick={addTier} size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar faixa
          </Button>
        </div>

        {/* Histórico de solicitações (paginado, 10/página) */}
        <WalletTopupsList refreshKey={refreshList} />
      </div>

      <ManualRechargeDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onSuccess={() => setRefreshList((k) => k + 1)}
      />
    </AdminLayout>
  );
};

export default AdminWalletTopup;