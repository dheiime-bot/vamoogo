import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Send, AlertCircle, Gift } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Config {
  enabled: boolean;
  whatsapp_number: string;
  central_name: string;
  message_template: string;
  quick_amounts: number[];
  allow_custom_amount: boolean;
  bonus_enabled?: boolean;
  bonus_tiers?: { min_amount: number; percent: number }[];
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WhatsappTopupModal = ({ open, onOpenChange }: Props) => {
  const { user, profile } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(null);
    setCustom("");
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "whatsapp_topup")
      .maybeSingle()
      .then(({ data }) => {
        setConfig((data?.value as any) || null);
        setLoading(false);
      });
  }, [open]);

  const finalAmount = useMemo(() => {
    if (selected != null) return selected;
    const v = Number(custom.replace(",", "."));
    return isFinite(v) && v > 0 ? v : 0;
  }, [selected, custom]);

  const isConfigured = !!(config?.enabled && config?.whatsapp_number);

  const handleConfirm = async () => {
    if (!user) return;
    if (!isConfigured || !config) {
      toast.error("Recarga via WhatsApp não está disponível no momento");
      return;
    }
    if (finalAmount <= 0) {
      toast.error("Selecione ou digite um valor");
      return;
    }

    setSending(true);
    const nome = profile?.full_name || "Motorista";
    const cpf = profile?.cpf || "";
    const telefone = profile?.phone || "";

    // Cria solicitação como pendente
    const { error } = await supabase.from("wallet_topups").insert({
      driver_id: user.id,
      nome,
      cpf,
      telefone,
      valor: finalAmount,
      status: "pendente",
    });

    if (error) {
      console.error(error);
      setSending(false);
      toast.error("Erro ao registrar solicitação");
      return;
    }

    // Substitui variáveis na mensagem
    const message = config.message_template
      .replace(/\{nome\}/g, nome)
      .replace(/\{cpf\}/g, cpf || "—")
      .replace(/\{telefone\}/g, telefone || "—")
      .replace(/\{id\}/g, user.id)
      .replace(/\{valor\}/g, formatBRL(finalAmount));

    const url = `https://wa.me/${config.whatsapp_number}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");

    toast.success("Solicitação enviada! Continue na conversa do WhatsApp.");
    setSending(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-success/10 p-2">
              <MessageCircle className="h-4 w-4 text-success" />
            </div>
            Recarregar saldo
          </DialogTitle>
          <DialogDescription>
            {config?.central_name
              ? `Sua solicitação será enviada para a ${config.central_name} via WhatsApp.`
              : "Sua solicitação será enviada via WhatsApp."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !isConfigured ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Recarga indisponível</p>
              <p className="text-xs text-muted-foreground mt-1">
                A recarga via WhatsApp ainda não foi configurada pela administração. Tente novamente
                mais tarde.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Quick amounts */}
            {config!.quick_amounts.length > 0 && (
              <div>
                <Label className="text-xs">Escolha um valor</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {config!.quick_amounts.map((v) => {
                    const active = selected === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setSelected(v);
                          setCustom("");
                        }}
                        className={`rounded-xl border-2 py-3 text-sm font-bold transition-all ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <p className="text-[9px] text-muted-foreground font-normal">R$</p>
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom amount */}
            {config!.allow_custom_amount && (
              <div className="space-y-1.5">
                <Label className="text-xs">Ou digite um valor (R$)</Label>
                <Input
                  value={custom}
                  onChange={(e) => {
                    setCustom(e.target.value);
                    setSelected(null);
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            )}

            {/* Resumo */}
            <div className="rounded-xl bg-muted/40 p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Valor da recarga</span>
              <span className="text-lg font-extrabold">
                R$ {formatBRL(finalAmount)}
              </span>
            </div>

            <Button
              onClick={handleConfirm}
              disabled={sending || finalAmount <= 0}
              className="w-full"
              size="lg"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Solicitar pelo WhatsApp
                </>
              )}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground">
              Após confirmar, você será levado ao WhatsApp para finalizar com a central.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WhatsappTopupModal;