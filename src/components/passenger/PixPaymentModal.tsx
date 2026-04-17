/**
 * PixPaymentModal — exibido ao passageiro no fim de uma corrida com pagamento Pix.
 * Mostra QR Code Pix estático com chave + valor + nome do motorista
 * e o "copia e cola" para pagamento.
 */
import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, QrCode, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildPixPayload, pixKeyTypeLabel, type PixKeyType } from "@/lib/pix";

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onMarkAsPaid?: () => void;
  driverName: string;
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  amount: number;
  rideId: string;
  merchantCity?: string;
}

const PixPaymentModal = ({
  open, onClose, onMarkAsPaid,
  driverName, pixKey, pixKeyType, amount, rideId, merchantCity,
}: PixPaymentModalProps) => {
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);

  const payload = useMemo(() => {
    if (!pixKey || !pixKeyType) return null;
    try {
      return buildPixPayload({
        key: pixKey,
        keyType: pixKeyType,
        amount,
        merchantName: driverName,
        merchantCity,
        txid: rideId.replace(/-/g, "").slice(0, 25),
        description: "Corrida Vamoo",
      });
    } catch {
      return null;
    }
  }, [pixKey, pixKeyType, amount, driverName, merchantCity, rideId]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleMark = async () => {
    if (!onMarkAsPaid) return;
    setMarking(true);
    await onMarkAsPaid();
    setMarking(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-t-3xl bg-card shadow-2xl animate-slide-up max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display">Pagar com Pix</h2>
              <p className="text-[11px] text-muted-foreground">Para {driverName}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Valor */}
          <div className="rounded-2xl bg-gradient-primary p-5 text-center shadow-glow">
            <p className="text-xs font-medium text-primary-foreground/80 uppercase tracking-wide">Valor a pagar</p>
            <p className="text-3xl font-extrabold text-primary-foreground mt-1">R$ {amount.toFixed(2)}</p>
          </div>

          {!pixKey || !pixKeyType || !payload ? (
            <div className="rounded-2xl border-2 border-warning/40 bg-warning/5 p-4 text-center">
              <p className="text-sm font-semibold text-warning-foreground">Motorista sem chave Pix cadastrada</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Combine o pagamento diretamente com o motorista.
              </p>
            </div>
          ) : (
            <>
              {/* QR Code */}
              <div className="rounded-2xl border bg-card p-4 flex flex-col items-center">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <QRCodeSVG value={payload} size={196} level="M" includeMargin={false} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  Abra o app do seu banco e escaneie o QR Code
                </p>
              </div>

              {/* Copia e cola */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Pix copia e cola
                </p>
                <div className="rounded-xl border bg-muted p-3">
                  <p className="text-[11px] font-mono break-all text-foreground/80 line-clamp-3">{payload}</p>
                </div>
                <button
                  onClick={handleCopy}
                  className="mt-2 w-full rounded-xl border-2 border-primary bg-primary/5 py-2.5 text-sm font-semibold text-primary flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado!" : "Copiar código Pix"}
                </button>
              </div>

              {/* Detalhes da chave */}
              <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tipo de chave</span>
                  <span className="font-semibold">{pixKeyTypeLabel[pixKeyType]}</span>
                </div>
                <div className="flex justify-between text-xs gap-3">
                  <span className="text-muted-foreground shrink-0">Chave</span>
                  <span className="font-mono font-medium truncate">{pixKey}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Recebedor</span>
                  <span className="font-semibold truncate">{driverName}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-card p-4 shrink-0 space-y-2">
          {onMarkAsPaid && (
            <button
              onClick={handleMark}
              disabled={marking}
              className="w-full rounded-xl bg-success py-3 text-sm font-bold text-success-foreground flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Já paguei
            </button>
          )}
          <button onClick={onClose} className="w-full rounded-xl border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PixPaymentModal;
