import { useEffect, useState } from "react";
import { User, Camera, FileText, Phone, Car as CarIcon, Shield, Star, ArrowLeft, QrCode, Loader2, Check, Pencil } from "lucide-react";
import AppMenu from "@/components/shared/AppMenu";
import DriverEarningsChip from "@/components/driver/DriverEarningsChip";

import StatusBadge from "@/components/shared/StatusBadge";
import EditProfileModal from "@/components/shared/EditProfileModal";
import DriverRatingsSection from "@/components/driver/DriverRatingsSection";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pixKeyTypeLabel, type PixKeyType } from "@/lib/pix";

const DriverProfile = () => {
  const navigate = useNavigate();
  const { profile, driverData, signOut, user, refreshProfile } = useAuth() as any;
  const [editOpen, setEditOpen] = useState(false);

  const [pixKey, setPixKey] = useState<string>("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf");
  const [savingPix, setSavingPix] = useState(false);

  useEffect(() => {
    if (driverData?.pix_key) setPixKey(driverData.pix_key);
    if (driverData?.pix_key_type) setPixKeyType(driverData.pix_key_type as PixKeyType);
  }, [driverData?.pix_key, driverData?.pix_key_type]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const validatePixKey = (value: string, type: PixKeyType): string | null => {
    const v = value.trim();
    if (!v) return "Informe a chave Pix";
    switch (type) {
      case "cpf": {
        const digits = v.replace(/\D/g, "");
        if (digits.length !== 11) return "CPF deve ter 11 dígitos";
        return null;
      }
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "E-mail inválido";
        return null;
      case "phone": {
        const digits = v.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 13) return "Telefone inválido";
        return null;
      }
      case "random":
        if (v.length < 32) return "Chave aleatória deve ter 32+ caracteres";
        return null;
    }
  };

  const handleSavePix = async () => {
    if (!user) return;
    const err = validatePixKey(pixKey, pixKeyType);
    if (err) { toast.error(err); return; }
    setSavingPix(true);
    const { error } = await supabase
      .from("drivers")
      .update({ pix_key: pixKey.trim(), pix_key_type: pixKeyType })
      .eq("user_id", user.id);
    setSavingPix(false);
    if (error) { toast.error("Não foi possível salvar"); return; }
    toast.success("Chave Pix salva!");
    refreshProfile?.();
  };

  const displayName = profile?.full_name || "Motorista";
  const categoryLabel = driverData?.category === "moto" ? "Moto" : driverData?.category === "conforto" ? "Conforto" : "Econômico";
  // Mapeia TODOS os status do enum driver_status (novos e legados) para o StatusBadge
  const statusMap: Record<string, "pending" | "approved" | "rejected" | "blocked"> = {
    pending: "pending",
    approved: "approved",
    rejected: "rejected",
    blocked: "blocked",
    cadastro_enviado: "pending",
    em_analise: "pending",
    pendente_documentos: "pending",
    aprovado: "approved",
    reprovado: "rejected",
  };
  const driverStatus = statusMap[driverData?.status] || "pending";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-dark p-6 pt-20 pb-16">
        <button onClick={() => navigate("/driver")} className="mb-4 text-primary-foreground/80"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold text-primary-foreground">Meu perfil</h1>
      </div>

      <div className="relative -mt-10 px-4">
        <div className="rounded-2xl border bg-card p-5 shadow-md">
          <div className="flex items-center gap-4">
            <UserAvatar
              src={profile?.selfie_url}
              name={displayName}
              role="driver"
              size="lg"
            />
            <div className="flex-1">
              <h2 className="text-lg font-bold">{displayName}</h2>
              <p className="text-sm text-muted-foreground">Motorista • {categoryLabel}</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={driverStatus} />
                <span className="flex items-center gap-0.5 text-xs"><Star className="h-3 w-3 text-warning" /> {driverData?.rating || "0.00"}</span>
              </div>
            </div>
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted flex items-center gap-1"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "Corridas", value: String(driverData?.total_rides || 0) },
            { label: "Avaliação", value: String(driverData?.rating || "0.00") },
            { label: "Cancelamentos", value: `${driverData?.daily_cancellations || 0}/3` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Chave Pix de recebimento */}
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-primary/10 p-2"><QrCode className="h-4 w-4 text-primary" /></div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Chave Pix de recebimento</h3>
              <p className="text-[11px] text-muted-foreground">
                Usada para gerar o QR Code que o passageiro paga no fim da corrida
              </p>
            </div>
            {driverData?.pix_key && <Check className="h-4 w-4 text-success" />}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {(Object.keys(pixKeyTypeLabel) as PixKeyType[]).map((t) => (
              <button
                key={t}
                onClick={() => setPixKeyType(t)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  pixKeyType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {pixKeyTypeLabel[t]}
              </button>
            ))}
          </div>

          <input
            type={pixKeyType === "email" ? "email" : "text"}
            inputMode={pixKeyType === "cpf" || pixKeyType === "phone" ? "numeric" : "text"}
            placeholder={
              pixKeyType === "cpf" ? "000.000.000-00"
                : pixKeyType === "email" ? "voce@exemplo.com"
                : pixKeyType === "phone" ? "(00) 00000-0000"
                : "Chave aleatória (UUID)"
            }
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className="mt-3 w-full rounded-lg border bg-muted px-3 py-2.5 text-sm outline-none focus:border-primary"
          />

          <button
            onClick={handleSavePix}
            disabled={savingPix}
            className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {savingPix && <Loader2 className="h-4 w-4 animate-spin" />}
            {driverData?.pix_key ? "Atualizar chave Pix" : "Salvar chave Pix"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Documentos & verificações</h3>
          {[
            { icon: FileText, label: "CPF", value: profile?.cpf ? `***-${profile.cpf.slice(-2)}` : "N/A", verified: true },
            { icon: CarIcon, label: "CNH (EAR)", value: driverData?.cnh_ear ? "Verificada" : "Pendente", verified: !!driverData?.cnh_ear },
            { icon: Camera, label: "Selfie facial", value: profile?.selfie_url ? "Verificada" : "Pendente", verified: !!profile?.selfie_url },
            { icon: Phone, label: "Telefone", value: profile?.phone || "N/A", verified: !!profile?.phone_verified },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2"><item.icon className="h-4 w-4 text-muted-foreground" /></div>
                <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.value}</p></div>
              </div>
              {item.verified && <Shield className="h-4 w-4 text-success" />}
            </div>
          ))}
        </div>

        <DriverRatingsSection />

        {driverData && (
          <div className="mt-4 rounded-2xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Veículo</h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Para mudar de categoria ou cadastrar um novo veículo, envie uma solicitação.
              O administrador analisa e aprova.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Modelo", value: driverData.vehicle_model || "N/A" },
                { label: "Cor", value: driverData.vehicle_color || "N/A" },
                { label: "Placa", value: driverData.vehicle_plate || "N/A" },
                { label: "Categoria", value: categoryLabel },
              ].map((v) => (
                <div key={v.label}><p className="text-xs text-muted-foreground">{v.label}</p><p className="text-sm font-medium">{v.value}</p></div>
              ))}
            </div>
            <button
              onClick={() => navigate("/driver/vehicles")}
              className="mt-4 w-full rounded-xl border border-primary/40 bg-primary/5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              Gerenciar veículos / mudar categoria
            </button>
          </div>
        )}

        <button onClick={handleLogout} className="mt-6 w-full rounded-xl border border-destructive/30 py-3 text-sm font-semibold text-destructive">
          Sair da conta
        </button>
      </div>

      <AppMenu role="driver" />
      <DriverEarningsChip />
      
      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
};

export default DriverProfile;
