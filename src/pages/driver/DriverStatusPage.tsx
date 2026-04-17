import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getDriverStatusInfo } from "@/lib/driverStatus";
import DocumentUpload from "@/components/auth/DocumentUpload";
import { LogOut, Loader2, RefreshCw, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const DriverStatusPage = () => {
  const { user, profile, driverData, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const info = getDriverStatusInfo(driverData?.status);
  const Icon = info.icon;

  // Reenvio de documentos (quando pendente_documentos ou reprovado)
  const [reuploading, setReuploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cnhFront, setCnhFront] = useState<string | null>(driverData?.cnh_front_url || null);
  const [cnhBack, setCnhBack] = useState<string | null>(driverData?.cnh_back_url || null);
  const [crlv, setCrlv] = useState<string | null>(driverData?.crlv_url || null);
  const [selfieDoc, setSelfieDoc] = useState<string | null>(driverData?.selfie_with_document_url || null);
  const [criminalRecord, setCriminalRecord] = useState<string | null>(driverData?.criminal_record_url || null);

  const canReupload = ["pendente_documentos", "reprovado", "rejected"].includes(driverData?.status);

  const handleRefresh = async () => {
    console.log("[DriverStatusPage] handleRefresh clicked", { user: user?.id, refreshing });
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }
    if (refreshing) return;
    setRefreshing(true);
    const previousStatus = driverData?.status;
    try {
      // Busca direto do banco (ignora cache do contexto)
      const { data, error } = await supabase
        .from("drivers")
        .select("status, analysis_message, analyzed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      console.log("[DriverStatusPage] refresh result", { data, error, previousStatus });
      if (error) throw error;

      await refreshProfile();

      const newStatus = data?.status;
      if (newStatus && newStatus !== previousStatus) {
        const newInfo = getDriverStatusInfo(newStatus);
        toast.success(`Status atualizado: ${newInfo.label}`);
        if (newInfo.canDrive) {
          setTimeout(() => navigate("/driver"), 800);
        }
      } else {
        toast.info("Nenhuma novidade ainda. Tente novamente em instantes.");
      }
    } catch (err: any) {
      console.error("[DriverStatusPage] refresh error", err);
      toast.error("Erro ao atualizar: " + (err.message || "tente novamente"));
    } finally {
      setRefreshing(false);
    }
  };


  const handleReupload = async () => {
    if (!user) return;
    setReuploading(true);
    const { error } = await supabase.from("drivers").update({
      cnh_front_url: cnhFront,
      cnh_back_url: cnhBack,
      crlv_url: crlv,
      selfie_with_document_url: selfieDoc,
      criminal_record_url: criminalRecord,
      status: "em_analise",
      analysis_message: null,
    }).eq("user_id", user.id);
    setReuploading(false);
    if (error) {
      toast.error("Erro ao reenviar: " + error.message);
      return;
    }
    toast.success("Documentos reenviados! Aguarde nova análise.");
    refreshProfile();
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-primary p-6 pb-10">
        <button onClick={handleLogout} className="mb-4 flex items-center gap-1 text-primary-foreground/80 text-xs">
          <LogOut className="h-4 w-4" /> Sair
        </button>
        <h1 className="text-xl font-bold font-display text-primary-foreground">Olá, {profile?.full_name?.split(" ")[0] || "Motorista"}</h1>
        <p className="text-xs text-primary-foreground/70">Acompanhe o status do seu cadastro</p>
      </div>

      <div className="relative -mt-4 rounded-t-3xl bg-card p-6 space-y-5">
        {/* Card de status principal */}
        <div className={`rounded-2xl border-2 p-5 ${info.bg}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-card`}>
              <Icon className={`h-6 w-6 ${info.color}`} />
            </div>
            <div>
              <p className={`text-lg font-bold ${info.color}`}>{info.label}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Status atual</p>
            </div>
          </div>
          <p className="text-sm text-foreground/80">{info.description}</p>
        </div>

        {/* Mensagem da equipe */}
        {driverData?.analysis_message && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Mensagem da equipe
            </p>
            <p className="text-sm">{driverData.analysis_message}</p>
            {driverData.analyzed_at && (
              <p className="text-[10px] text-muted-foreground mt-2">
                {new Date(driverData.analyzed_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        )}

        {/* Aviso explícito */}
        {!info.canDrive && (
          <div className="rounded-xl bg-warning/10 border border-warning/30 p-3">
            <p className="text-xs font-semibold text-warning">⚠️ Você não pode receber corridas</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              O acesso à plataforma será liberado assim que seu cadastro for aprovado.
            </p>
          </div>
        )}

        {/* Reenvio de documentos */}
        {canReupload && (
          <div className="space-y-3">
            <div className="rounded-xl bg-info/5 border border-info/20 p-3">
              <p className="text-sm font-semibold text-info">Reenviar documentos</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Atualize os documentos e envie para nova análise.
              </p>
            </div>
            <DocumentUpload
              label="CNH (frente)"
              bucket="driver-documents"
              pathPrefix={`${user?.id}/cnh-frente`}
              value={cnhFront}
              onChange={setCnhFront}
              capture="environment"
            />
            <DocumentUpload
              label="CNH (verso)"
              bucket="driver-documents"
              pathPrefix={`${user?.id}/cnh-verso`}
              value={cnhBack}
              onChange={setCnhBack}
              capture="environment"
            />
            <DocumentUpload
              label="CRLV (PDF ou imagem)"
              bucket="driver-documents"
              pathPrefix={`${user?.id}/crlv`}
              value={crlv}
              onChange={setCrlv}
              capture="environment"
              acceptPdf
            />
            <DocumentUpload
              label="Selfie com documento"
              bucket="driver-documents"
              pathPrefix={`${user?.id}/selfie-doc`}
              value={selfieDoc}
              onChange={setSelfieDoc}
              capture="user"
            />
            <DocumentUpload
              label="Certidão de antecedentes criminais (PDF ou imagem)"
              bucket="driver-documents"
              pathPrefix={`${user?.id}/antecedentes`}
              value={criminalRecord}
              onChange={setCriminalRecord}
              acceptPdf
            />
            <button
              onClick={handleReupload}
              disabled={reuploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {reuploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reenviar documentos
            </button>
          </div>
        )}

        {/* Resumo */}
        <div className="rounded-xl border p-3 space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Seu cadastro</p>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Veículo</span><span className="font-medium">{driverData?.vehicle_brand} {driverData?.vehicle_model}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Placa</span><span className="font-mono font-bold">{driverData?.vehicle_plate}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Categoria</span><span className="font-medium capitalize">{driverData?.category}</span></div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {refreshing ? "Verificando..." : "Atualizar status"}
        </button>
      </div>
    </div>
  );
};

export default DriverStatusPage;
