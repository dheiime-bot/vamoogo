import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { XCircle, AlertTriangle, Loader2, ShieldCheck, Clock, ArrowLeft } from "lucide-react";
import { guardErrorMessage } from "@/lib/guardErrors";

type Role = "passenger" | "driver";

interface Reason {
  id: string;
  code: string;
  label: string;
  description: string | null;
  counts_as_punishment: boolean;
}

interface Rules {
  grace_seconds: number;
  daily_limit: number;
  block_hours_sequence: number[];
  after_sequence_multiplier: number;
  apply_to_passenger: boolean;
  apply_to_driver: boolean;
}

const DEFAULT_RULES: Rules = {
  grace_seconds: 120,
  daily_limit: 3,
  block_hours_sequence: [2, 5, 12, 24, 48],
  after_sequence_multiplier: 2,
  apply_to_passenger: true,
  apply_to_driver: true,
};

/** Calcula a próxima penalidade prevista (em horas). */
const nextBlockHours = (rules: Rules, currentBlockCount: number, currentDaily: number): number => {
  if (currentDaily + 1 < rules.daily_limit) return 0;
  const seq = rules.block_hours_sequence;
  const idx = currentBlockCount; // próxima vez = count + 1, mas array é 0-based
  if (idx < seq.length) return seq[idx];
  const last = seq[seq.length - 1] || 24;
  return Math.round(last * Math.pow(rules.after_sequence_multiplier, idx - seq.length + 1));
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCancelled: () => void;
  rideId: string | null;
  /** Quem está cancelando — define a lista de motivos exibida. */
  role: Role;
  /** true se a corrida já foi aceita pelo motorista (mostra aviso de punição). */
  afterAccept: boolean;
  /** Quando true, mostra dupla confirmação (corrida em andamento). */
  inProgress?: boolean;
  /** Timestamp do aceite (para countdown da carência). */
  acceptedAt?: string | null;
}

/**
 * Modal único de cancelamento (passageiro/motorista).
 * - Antes do aceite: cancelamento livre, sem aviso de punição.
 * - Após o aceite: motivo obrigatório, mostra penalidade prevista e carência.
 * - Em andamento: exige dupla confirmação.
 */
const CancelRideDialog = ({
  open, onClose, onCancelled, rideId, role, afterAccept,
  inProgress = false, acceptedAt = null,
}: Props) => {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [loadingReasons, setLoadingReasons] = useState(true);
  const [reasonId, setReasonId] = useState<string>("");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [userPunishCtx, setUserPunishCtx] = useState({ blockCount: 0, dailyCount: 0 });

  // Carrega motivos + regras quando abrir
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingReasons(true);
    (async () => {
      const [reasonsRes, settingsRes, userRes] = await Promise.all([
        supabase
          .from("cancellation_reasons" as any)
          .select("id, code, label, description, counts_as_punishment, sort_order")
          .eq("role", role)
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabase.from("platform_settings").select("value").eq("key", "cancellation_rules").maybeSingle(),
        (async () => {
          const { data: u } = await supabase.auth.getUser();
          const uid = u.user?.id;
          if (!uid) return null;
          if (role === "passenger") {
            const { data } = await supabase
              .from("profiles")
              .select("cancellation_block_count, daily_cancellations, last_cancellation_reset")
              .eq("user_id", uid).maybeSingle();
            return data;
          }
          const { data } = await supabase
            .from("drivers")
            .select("cancellation_block_count, daily_cancellations, last_cancellation_reset")
            .eq("user_id", uid).maybeSingle();
          return data;
        })(),
      ]);
      if (cancelled) return;
      const list = ((reasonsRes.data as any[]) || []) as Reason[];
      setReasons(list);
      setReasonId(list[0]?.id || "");
      if (settingsRes.data?.value) {
        const v = settingsRes.data.value as any;
        setRules({
          grace_seconds: Number(v.grace_seconds ?? DEFAULT_RULES.grace_seconds),
          daily_limit: Number(v.daily_limit ?? DEFAULT_RULES.daily_limit),
          block_hours_sequence: Array.isArray(v.block_hours_sequence)
            ? v.block_hours_sequence.map((h: any) => Number(h)).filter((h: number) => h > 0)
            : DEFAULT_RULES.block_hours_sequence,
          after_sequence_multiplier: Number(v.after_sequence_multiplier ?? DEFAULT_RULES.after_sequence_multiplier),
          apply_to_passenger: v.apply_to_passenger !== false,
          apply_to_driver: v.apply_to_driver !== false,
        });
      }
      const today = new Date().toISOString().slice(0, 10);
      const u = userRes as any;
      setUserPunishCtx({
        blockCount: u?.cancellation_block_count || 0,
        dailyCount: u?.last_cancellation_reset === today ? (u?.daily_cancellations || 0) : 0,
      });
      setLoadingReasons(false);
    })();
    return () => { cancelled = true; };
  }, [open, role]);

  // Reseta quando fecha
  useEffect(() => {
    if (!open) {
      setExtra("");
      setConfirmStep(false);
    }
  }, [open]);

  // Tick para countdown
  useEffect(() => {
    if (!open || !afterAccept) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [open, afterAccept]);

  const selectedReason = useMemo(
    () => reasons.find((r) => r.id === reasonId) || null,
    [reasonId, reasons]
  );

  // Carência restante (em segundos). Só conta se temos acceptedAt.
  const graceRemaining = useMemo(() => {
    if (!afterAccept || !acceptedAt) return null;
    const elapsed = (now - new Date(acceptedAt).getTime()) / 1000;
    const left = Math.max(0, rules.grace_seconds - elapsed);
    return Math.ceil(left);
  }, [afterAccept, acceptedAt, now, rules.grace_seconds]);

  const willPunish = useMemo(() => {
    if (!afterAccept) return false;
    if (graceRemaining !== null && graceRemaining > 0) return false;
    if (selectedReason && !selectedReason.counts_as_punishment) return false;
    if (role === "passenger" && !rules.apply_to_passenger) return false;
    if (role === "driver" && !rules.apply_to_driver) return false;
    return true;
  }, [afterAccept, graceRemaining, selectedReason, role, rules]);

  const punishHours = useMemo(
    () => willPunish ? nextBlockHours(rules, userPunishCtx.blockCount, userPunishCtx.dailyCount) : 0,
    [willPunish, rules, userPunishCtx]
  );

  const handleConfirm = async () => {
    if (!rideId) return;
    if (afterAccept && !selectedReason) {
      toast.error("Selecione um motivo");
      return;
    }
    // Dupla confirmação para corrida em andamento
    if (inProgress && !confirmStep) {
      setConfirmStep(true);
      return;
    }
    setLoading(true);
    const note = extra.trim().slice(0, 280);
    const finalReason = selectedReason
      ? (note ? `${selectedReason.label} — ${note}` : selectedReason.label)
      : (note || "Cancelamento sem motivo informado");
    const { data, error } = await supabase.rpc("cancel_ride" as any, {
      _ride_id: rideId,
      _reason: finalReason,
      _reason_code: selectedReason?.code || null,
      _reason_note: note || null,
    });
    setLoading(false);
    if (error) {
      toast.error(guardErrorMessage(error, "Não foi possível cancelar"));
      return;
    }
    const counted = (data as any)?.counted_for_punishment;
    const blockHours = (data as any)?.block_hours;
    if (blockHours) {
      toast.error(`Você foi bloqueado por ${blockHours}h por excesso de cancelamentos`);
    } else if (counted) {
      toast.warning("Cancelamento registrado. Pode contar para bloqueio.");
    } else {
      toast.success("Corrida cancelada");
    }
    onCancelled();
    onClose();
  };

  const formatGrace = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r.toString().padStart(2, "0")}s` : `${r}s`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" /> Cancelar corrida
          </DialogTitle>
          <DialogDescription>
            {confirmStep
              ? "Confirme novamente — esta corrida já está em andamento."
              : afterAccept
                ? "Selecione um motivo para cancelar."
                : "Tem certeza que deseja cancelar?"}
          </DialogDescription>
        </DialogHeader>

        {/* Carência ativa */}
        {afterAccept && graceRemaining !== null && graceRemaining > 0 && (
          <div className="rounded-xl border border-success/40 bg-success/10 p-3 text-xs flex gap-2">
            <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-success">
                Sem penalidade — {formatGrace(graceRemaining)} restantes
              </p>
              <p className="text-muted-foreground">
                Cancelar agora não conta como punição.
              </p>
            </div>
          </div>
        )}

        {/* Penalidade prevista */}
        {afterAccept && willPunish && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs flex gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-warning">
                {punishHours > 0
                  ? `Atenção: você ficará bloqueado por ${punishHours}h`
                  : "Atenção: este cancelamento conta como punição"}
              </p>
              <p className="text-muted-foreground">
                Hoje: {userPunishCtx.dailyCount}/{rules.daily_limit} cancelamentos.
                {" "}A cada {rules.daily_limit} no mesmo dia, é aplicado um bloqueio progressivo.
              </p>
            </div>
          </div>
        )}

        {/* Aviso de carência ativa para corridas só aceitas (sem grace ainda passada) */}
        {afterAccept && graceRemaining === null && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs flex gap-2">
            <Clock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Cancelar pode contar como punição dependendo do motivo e do tempo desde o aceite.
            </p>
          </div>
        )}

        {/* Confirmação dupla — em andamento */}
        {confirmStep && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs flex gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-foreground/90">
              <span className="font-bold text-destructive">Esta corrida já começou.</span>{" "}
              Cancelar agora pode gerar cobrança ao passageiro e penalidade.
            </p>
          </div>
        )}

        {!confirmStep && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                Motivo {afterAccept && <span className="text-destructive">*</span>}
              </label>
              {loadingReasons ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando motivos…
                </div>
              ) : (
                <select
                  value={reasonId}
                  onChange={(e) => setReasonId(e.target.value)}
                  className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
                  disabled={loading}
                >
                  {reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}{!r.counts_as_punishment ? " (sem punição)" : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedReason?.description && (
                <p className="text-[11px] text-muted-foreground">{selectedReason.description}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Detalhes (opcional)</label>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                maxLength={280}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm min-h-[60px]"
                placeholder="Conte rapidamente o que aconteceu…"
                disabled={loading}
              />
              <p className="text-[10px] text-muted-foreground text-right">{extra.length}/280</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => confirmStep ? setConfirmStep(false) : onClose()}
            disabled={loading}
            className="flex-1 rounded-xl border bg-card py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {confirmStep && <ArrowLeft className="h-4 w-4" />}
            {confirmStep ? "Voltar" : "Não cancelar"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (afterAccept && !selectedReason && !loadingReasons)}
            className="flex-1 rounded-xl bg-destructive text-destructive-foreground py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading
              ? "Cancelando..."
              : confirmStep
                ? "Sim, cancelar"
                : inProgress
                  ? "Continuar"
                  : "Confirmar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancelRideDialog;