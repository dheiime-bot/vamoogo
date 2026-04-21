import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, User, FileText, Calendar, Loader2, Camera, CheckCircle2,
  AlertCircle, Car, Bike, Sparkles, KeyRound, CreditCard, Hash, Palette, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryColor } from "@/lib/categoryStyle";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, formatCPF, formatPhone, formatPlate } from "@/lib/validators";
import { formatRenavam, validateRenavam } from "@/lib/validators";
import { validatePlate, isFakePlate } from "@/lib/plateValidator";
import { formatDateBR, parseDateBRtoISO } from "@/lib/brFormat";
import DocumentUpload from "@/components/auth/DocumentUpload";
import LiveSelfieCapture from "@/components/auth/LiveSelfieCapture";
import { toast } from "sonner";

type StepKey = "selfie" | "veiculo" | "documentos" | "antecedentes" | "pix";

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "selfie", label: "Selfie ao vivo" },
  { key: "veiculo", label: "Veículo" },
  { key: "documentos", label: "Documentos" },
  { key: "antecedentes", label: "Antecedentes" },
  { key: "pix", label: "Pix" },
];

const CATEGORIES = [
  { id: "moto", label: "Moto", icon: Bike, desc: "Entregas e corridas rápidas" },
  { id: "economico", label: "Econômico", icon: Car, desc: "Carros populares" },
  { id: "conforto", label: "Conforto", icon: Sparkles, desc: "Carros mais novos" },
];

const PIX_TYPES = [
  { id: "cpf", label: "CPF" },
  { id: "email", label: "E-mail" },
  { id: "phone", label: "Telefone" },
  { id: "random", label: "Chave aleatória" },
];

const calcAge = (isoDate?: string | null): number | null => {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
};

const BecomeDriver = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasDriver, setHasDriver] = useState(false);

  // CPF do passageiro (usado como prefixo de pasta de upload)
  const cpfDigits = (profile?.cpf || "").replace(/\D/g, "");
  const age = useMemo(() => calcAge(profile?.birth_date), [profile?.birth_date]);

  // Estados do wizard
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [selfieLivenessUrl, setSelfieLivenessUrl] = useState<string | null>(null);
  const [livenessVerified, setLivenessVerified] = useState(false);

  const [category, setCategory] = useState("economico");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleRenavam, setVehicleRenavam] = useState("");
  const [vehiclePhotoFront, setVehiclePhotoFront] = useState<string | null>(null);
  const [vehiclePhotoBack, setVehiclePhotoBack] = useState<string | null>(null);
  const [vehiclePhotoLeft, setVehiclePhotoLeft] = useState<string | null>(null);
  const [vehiclePhotoRight, setVehiclePhotoRight] = useState<string | null>(null);

  const [cnhNumber, setCnhNumber] = useState("");
  const [cnhEar, setCnhEar] = useState(false);
  const [cnhFrontUrl, setCnhFrontUrl] = useState<string | null>(null);
  const [cnhBackUrl, setCnhBackUrl] = useState<string | null>(null);
  const [crlvUrl, setCrlvUrl] = useState<string | null>(null);
  const [selfieDocUrl, setSelfieDocUrl] = useState<string | null>(null);

  const [criminalRecordUrl, setCriminalRecordUrl] = useState<string | null>(null);
  const [criminalRecordDate, setCriminalRecordDate] = useState("");

  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixHolderName, setPixHolderName] = useState(profile?.full_name || "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const setErr = (k: string, msg: string) => setErrors((e) => ({ ...e, [k]: msg }));
  const clearErr = (k: string) => setErrors((e) => { const c = { ...e }; delete c[k]; return c; });

  const currentYear = new Date().getFullYear();

  // Verifica se já é motorista
  useEffect(() => {
    if (!user) return;
    supabase.from("drivers").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setHasDriver(!!data));
  }, [user]);

  // Pré-preenche nome do PIX quando o profile carrega
  useEffect(() => {
    if (profile?.full_name && !pixHolderName) setPixHolderName(profile.full_name);
  }, [profile?.full_name]);

  // Validações
  const validateYear = (v: string) => {
    const y = parseInt(v, 10);
    if (!v) return "Informe o ano";
    if (isNaN(y) || y < 2000 || y > currentYear + 1) return `Ano deve estar entre 2000 e ${currentYear + 1}`;
    if (category === "conforto" && y < currentYear - 8) return "Conforto exige veículo até 8 anos de uso";
    return "";
  };
  const validatePlateField = (v: string) => {
    const cleaned = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!cleaned) return "Informe a placa";
    if (!validatePlate(cleaned)) return "Placa inválida (ex: ABC1D23 ou ABC1234)";
    const fake = isFakePlate(cleaned);
    return fake.fake ? fake.reason || "Placa inválida" : "";
  };
  const validateCnh = (v: string) => {
    const cleaned = v.replace(/\D/g, "");
    if (!cleaned) return "Informe o número da CNH";
    if (cleaned.length !== 11) return "CNH deve ter 11 dígitos";
    return "";
  };

  const validateStepSelfie = () => {
    if (!selfieUrl) { toast.error("Tire sua selfie ao vivo"); return false; }
    if (!livenessVerified) { toast.error("Verificação anti-fraude obrigatória"); return false; }
    return true;
  };

  const validateStepVeiculo = async () => {
    const errs: Record<string, string> = {};
    if (!vehicleBrand.trim()) errs.brand = "Informe a marca";
    if (!vehicleModel.trim()) errs.model = "Informe o modelo";
    if (!vehicleColor.trim()) errs.color = "Informe a cor";
    const ey = validateYear(vehicleYear); if (ey) errs.year = ey;
    const ep = validatePlateField(vehiclePlate); if (ep) errs.plate = ep;
    const cleanRenavam = vehicleRenavam.replace(/\D/g, "");
    if (!cleanRenavam) errs.renavam = "Informe o RENAVAM";
    else if (!validateRenavam(cleanRenavam)) errs.renavam = "RENAVAM inválido (9 a 11 dígitos)";
    if (!vehiclePhotoFront) errs.photoFront = "Envie a foto da frente";
    if (!vehiclePhotoBack) errs.photoBack = "Envie a foto da traseira";
    if (!vehiclePhotoLeft) errs.photoLeft = "Envie a foto da lateral esquerda";
    if (!vehiclePhotoRight) errs.photoRight = "Envie a foto da lateral direita";
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Corrija os campos destacados"); return false; }

    setLoading(true);
    try {
      const cleanPlate = vehiclePlate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const { data: dupes } = await supabase.rpc("driver_check_vehicle_dupes", {
        _plate: cleanPlate,
        _renavam: cleanRenavam,
      });
      const row = Array.isArray(dupes) ? dupes[0] : dupes;
      if (row?.plate_taken && !row?.plate_owner_is_self) {
        setErr("plate", "Esta placa já está cadastrada");
        toast.error("Placa já cadastrada");
        return false;
      }
      if (row?.renavam_taken && !row?.renavam_owner_is_self) {
        setErr("renavam", "Este RENAVAM já está cadastrado");
        toast.error("RENAVAM já cadastrado em outro veículo");
        return false;
      }
    } finally { setLoading(false); }
    return true;
  };

  const validateStepDocumentos = () => {
    const errs: Record<string, string> = {};
    const ec = validateCnh(cnhNumber); if (ec) errs.cnh = ec;
    if (!cnhEar) errs.cnhEar = "É obrigatório possuir CNH com observação EAR";
    if (!cnhFrontUrl) errs.cnhFront = "Envie a frente da CNH";
    if (!cnhBackUrl) errs.cnhBack = "Envie o verso da CNH";
    if (!crlvUrl) errs.crlv = "Envie o CRLV";
    if (!selfieDocUrl) errs.selfieDoc = "Envie a selfie segurando o documento";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(errs.cnhEar || "Envie todos os documentos");
      return false;
    }
    return true;
  };

  const validateStepAntecedentes = () => {
    const errs: Record<string, string> = {};
    if (!criminalRecordUrl) errs.criminal = "Envie a certidão";
    if (!criminalRecordDate) errs.criminalDate = "Informe a data";
    else {
      const iso = parseDateBRtoISO(criminalRecordDate);
      if (!iso) errs.criminalDate = "Data inválida";
      else {
        const d = new Date(iso);
        const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
        if (days < 0) errs.criminalDate = "Data não pode ser futura";
        else if (days > 90) errs.criminalDate = "Certidão deve ter sido emitida nos últimos 90 dias";
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Corrija os campos destacados"); return false; }
    return true;
  };

  const validateStepPix = () => {
    const errs: Record<string, string> = {};
    if (!pixKey.trim()) errs.pixKey = "Informe a chave Pix";
    if (!pixHolderName.trim() || pixHolderName.trim().length < 5) errs.pixHolder = "Informe o nome completo";
    if (pixKeyType === "cpf") {
      const c = pixKey.replace(/\D/g, "");
      if (!validateCPF(c)) errs.pixKey = "CPF do Pix inválido";
    } else if (pixKeyType === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(pixKey.trim())) errs.pixKey = "E-mail Pix inválido";
    } else if (pixKeyType === "phone") {
      const c = pixKey.replace(/\D/g, "");
      if (c.length < 10 || c.length > 11) errs.pixKey = "Telefone Pix inválido";
    } else if (pixKeyType === "random") {
      if (pixKey.replace(/\s/g, "").length < 32) errs.pixKey = "Chave aleatória inválida";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Corrija os campos destacados"); return false; }
    return true;
  };

  const next = async () => {
    let ok = false;
    if (step === 0) ok = validateStepSelfie();
    else if (step === 1) ok = await validateStepVeiculo();
    else if (step === 2) ok = validateStepDocumentos();
    else if (step === 3) ok = validateStepAntecedentes();
    else if (step === 4) {
      ok = validateStepPix();
      if (ok) return handleSubmit();
    }
    if (ok && step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const back = () => {
    if (step === 0) navigate("/passenger/profile");
    else setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const cleanPlate = vehiclePlate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const isoCriminal = parseDateBRtoISO(criminalRecordDate);
      const { error } = await supabase.rpc("become_driver", {
        _category: category as any,
        _vehicle_brand: vehicleBrand.trim(),
        _vehicle_model: vehicleModel.trim(),
        _vehicle_color: vehicleColor.trim(),
        _vehicle_year: parseInt(vehicleYear, 10),
        _vehicle_plate: cleanPlate,
        _vehicle_renavam: vehicleRenavam.replace(/\D/g, ""),
        _cnh_number: cnhNumber.replace(/\D/g, ""),
        _cnh_ear: cnhEar,
        _cnh_front_url: cnhFrontUrl || "",
        _cnh_back_url: cnhBackUrl || "",
        _crlv_url: crlvUrl || "",
        _selfie_with_document_url: selfieDocUrl || "",
        _criminal_record_url: criminalRecordUrl || "",
        _criminal_record_issued_at: isoCriminal,
        _selfie_liveness_url: selfieLivenessUrl,
        _liveness_verified: livenessVerified,
        _vehicle_photo_front_url: vehiclePhotoFront || "",
        _vehicle_photo_back_url: vehiclePhotoBack || "",
        _vehicle_photo_left_url: vehiclePhotoLeft || "",
        _vehicle_photo_right_url: vehiclePhotoRight || "",
        _pix_key: pixKey.trim(),
        _pix_key_type: pixKeyType,
        _pix_holder_name: pixHolderName.trim(),
      });
      if (error) throw error;
      await refreshProfile();
      toast.success("Cadastro enviado! Aguarde a análise da equipe.");
      navigate("/driver/status");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar cadastro");
    } finally {
      setLoading(false);
    }
  };

  // Bloqueios
  if (!user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (hasDriver) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-success mb-3" />
        <h1 className="text-xl font-bold mb-1">Você já é motorista</h1>
        <p className="text-sm text-muted-foreground mb-6">Acompanhe o status da sua análise.</p>
        <button onClick={() => navigate("/driver/status")} className="rounded-xl bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          Ver status
        </button>
      </div>
    );
  }

  if (age === null || age < 21) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <AlertCircle className="h-12 w-12 text-warning mb-3" />
        <h1 className="text-xl font-bold mb-1">Idade mínima: 21 anos</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Para se tornar motorista é necessário ter no mínimo 21 anos.
          {age !== null && ` Sua idade cadastrada: ${age} anos.`}
        </p>
        <button onClick={() => navigate("/passenger/profile")} className="rounded-xl border bg-card px-6 py-3 text-sm font-semibold">
          Voltar ao perfil
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-gradient-primary p-6 pb-10 text-primary-foreground">
        <button onClick={back} className="mb-4 flex items-center gap-1 text-primary-foreground/80 text-sm">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/20">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display">Quero ser motorista</h1>
            <p className="text-xs text-primary-foreground/80">
              Etapa {step + 1} de {STEPS.length} · {STEPS[step].label}
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-primary-foreground" : "bg-primary-foreground/30"}`} />
          ))}
        </div>
      </div>

      <div className="relative -mt-6 flex-1 rounded-t-3xl bg-card p-6 pb-10">
        {/* Resumo do passageiro */}
        <div className="mb-4 rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="font-semibold mb-1">Reaproveitando seus dados de passageiro</p>
          <div className="text-muted-foreground space-y-0.5">
            <p>{profile.full_name} · {age} anos</p>
            <p>CPF: {profile.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</p>
            <p>Telefone: {profile.phone || "—"}</p>
          </div>
        </div>

        {/* STEP 0: Selfie */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-xl border-2 border-info/30 bg-info/10 p-4">
              <p className="text-sm font-bold text-info flex items-center gap-2">
                <Camera className="h-4 w-4" /> Selfie ao vivo
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Captura ao vivo pela câmera frontal. Você precisará <strong>piscar</strong> na verificação.
              </p>
            </div>
            <LiveSelfieCapture
              label="Selfie obrigatória (com verificação anti-fraude)"
              bucket="selfies"
              pathPrefix={`upgrade/${cpfDigits}/selfie`}
              value={selfieUrl}
              onChange={(url, meta) => {
                setSelfieUrl(url);
                setSelfieLivenessUrl(meta?.livenessUrl || null);
                setLivenessVerified(meta?.verified || false);
              }}
              liveness
              hint="Boa iluminação, sem óculos, rosto centralizado"
            />
            <NextBtn onClick={next} loading={loading} disabled={!selfieUrl || !livenessVerified} />
          </div>
        )}

        {/* STEP 1: Veículo */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Categoria</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const color = getCategoryColor(c.id);
                  const isActive = category === c.id;
                  return (
                    <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${isActive ? "bg-primary/5" : "border-border bg-muted/30"}`}
                      style={isActive ? { borderColor: color, backgroundColor: `${color}14` } : undefined}>
                      <c.icon className="h-5 w-5" style={{ color }} />
                      <span className="text-xs font-semibold">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Marca" icon={<Car className="h-4 w-4" />} value={vehicleBrand} onChange={(v) => { setVehicleBrand(v); v.trim() ? clearErr("brand") : setErr("brand", "Informe a marca"); }} placeholder="Ex: Volkswagen" error={errors.brand} />
            <Field label="Modelo" icon={<Car className="h-4 w-4" />} value={vehicleModel} onChange={(v) => { setVehicleModel(v); v.trim() ? clearErr("model") : setErr("model", "Informe o modelo"); }} placeholder="Ex: Gol 1.0" error={errors.model} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cor" icon={<Palette className="h-4 w-4" />} value={vehicleColor} onChange={(v) => { setVehicleColor(v); v.trim() ? clearErr("color") : setErr("color", "Informe a cor"); }} placeholder="Branco" error={errors.color} />
              <Field label="Ano" icon={<Calendar className="h-4 w-4" />} value={vehicleYear} onChange={(v) => { const f = v.replace(/\D/g, "").slice(0, 4); setVehicleYear(f); const e = validateYear(f); e ? setErr("year", e) : clearErr("year"); }} placeholder={String(currentYear)} error={errors.year} maxLength={4} inputMode="numeric" />
            </div>
            <Field label="Placa" icon={<Hash className="h-4 w-4" />} value={vehiclePlate} onChange={(v) => { const f = formatPlate(v); setVehiclePlate(f); const e = validatePlateField(f); e ? setErr("plate", e) : clearErr("plate"); }} placeholder="ABC-1D23" error={errors.plate} maxLength={8} />
            <Field label="RENAVAM" icon={<FileText className="h-4 w-4" />} value={vehicleRenavam} onChange={(v) => { const f = formatRenavam(v); setVehicleRenavam(f); clearErr("renavam"); }} placeholder="11 dígitos do CRLV" error={errors.renavam} maxLength={11} inputMode="numeric" />

            <div className="grid grid-cols-2 gap-3">
              {[
                { lbl: "Frente", url: vehiclePhotoFront, set: setVehiclePhotoFront, key: "photoFront", path: "veiculo-frente" },
                { lbl: "Traseira", url: vehiclePhotoBack, set: setVehiclePhotoBack, key: "photoBack", path: "veiculo-traseira" },
                { lbl: "Lat. esq.", url: vehiclePhotoLeft, set: setVehiclePhotoLeft, key: "photoLeft", path: "veiculo-lat-esq" },
                { lbl: "Lat. dir.", url: vehiclePhotoRight, set: setVehiclePhotoRight, key: "photoRight", path: "veiculo-lat-dir" },
              ].map((p) => (
                <div key={p.key}>
                  <DocumentUpload label={p.lbl} bucket="driver-documents" pathPrefix={`upgrade/${cpfDigits}/${p.path}`} value={p.url} onChange={(u) => { p.set(u); u && clearErr(p.key); }} capture="environment" />
                  {errors[p.key] && <p className="text-[10px] text-destructive mt-1">{errors[p.key]}</p>}
                </div>
              ))}
            </div>
            <NextBtn onClick={next} loading={loading} />
          </div>
        )}

        {/* STEP 2: Documentos */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <Field label="Número da CNH" icon={<FileText className="h-4 w-4" />} value={cnhNumber} onChange={(v) => { const f = v.replace(/\D/g, "").slice(0, 11); setCnhNumber(f); const e = validateCnh(f); e ? setErr("cnh", e) : clearErr("cnh"); }} placeholder="11 dígitos" error={errors.cnh} maxLength={11} inputMode="numeric" />
            <label className={`flex items-center gap-2 cursor-pointer rounded-xl border bg-background p-3 ${errors.cnhEar ? "border-destructive" : ""}`}>
              <input type="checkbox" checked={cnhEar} onChange={(e) => { setCnhEar(e.target.checked); if (e.target.checked) clearErr("cnhEar"); }} className="h-4 w-4 rounded border-input accent-primary" />
              <span className="text-xs">Confirmo que minha CNH possui a observação <strong>EAR</strong> (Exerce Atividade Remunerada)</span>
            </label>
            {errors.cnhEar && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {errors.cnhEar}</p>}

            <DocumentUpload label="CNH (frente)" bucket="driver-documents" pathPrefix={`upgrade/${cpfDigits}/cnh-frente`} value={cnhFrontUrl} onChange={setCnhFrontUrl} capture="environment" />
            {errors.cnhFront && <p className="text-xs text-destructive -mt-2">{errors.cnhFront}</p>}
            <DocumentUpload label="CNH (verso)" bucket="driver-documents" pathPrefix={`upgrade/${cpfDigits}/cnh-verso`} value={cnhBackUrl} onChange={setCnhBackUrl} capture="environment" />
            {errors.cnhBack && <p className="text-xs text-destructive -mt-2">{errors.cnhBack}</p>}
            <DocumentUpload label="CRLV (PDF ou imagem)" bucket="driver-documents" pathPrefix={`upgrade/${cpfDigits}/crlv`} value={crlvUrl} onChange={setCrlvUrl} acceptPdf />
            {errors.crlv && <p className="text-xs text-destructive -mt-2">{errors.crlv}</p>}
            <DocumentUpload label="Selfie segurando a CNH" bucket="driver-documents" pathPrefix={`upgrade/${cpfDigits}/selfie-doc`} value={selfieDocUrl} onChange={setSelfieDocUrl} capture="user" />
            {errors.selfieDoc && <p className="text-xs text-destructive -mt-2">{errors.selfieDoc}</p>}
            <NextBtn onClick={next} loading={loading} />
          </div>
        )}

        {/* STEP 3: Antecedentes */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-xl border-2 border-warning/30 bg-warning/10 p-4">
              <p className="text-sm font-bold text-warning flex items-center gap-2">
                <Shield className="h-4 w-4" /> Certidão de antecedentes
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Emitida pelo Tribunal de Justiça do seu estado, dentro de 90 dias.
              </p>
            </div>
            <DocumentUpload label="Certidão (PDF ou imagem)" bucket="driver-documents" pathPrefix={`upgrade/${cpfDigits}/antecedentes`} value={criminalRecordUrl} onChange={setCriminalRecordUrl} acceptPdf />
            {errors.criminal && <p className="text-xs text-destructive -mt-2">{errors.criminal}</p>}
            <Field label="Data de emissão" icon={<Calendar className="h-4 w-4" />} value={criminalRecordDate} onChange={(v) => { setCriminalRecordDate(formatDateBR(v)); clearErr("criminalDate"); }} placeholder="DD/MM/AAAA" error={errors.criminalDate} maxLength={10} inputMode="numeric" />
            <NextBtn onClick={next} loading={loading} />
          </div>
        )}

        {/* STEP 4: Pix */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4">
              <p className="text-sm font-bold text-success flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Conta para receber
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">Você receberá seus ganhos via Pix.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Tipo de chave Pix</label>
              <div className="grid grid-cols-2 gap-2">
                {PIX_TYPES.map((t) => (
                  <button key={t.id} type="button" onClick={() => { setPixKeyType(t.id); setPixKey(""); }}
                    className={`rounded-xl border-2 py-2.5 text-xs font-semibold ${pixKeyType === t.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-muted/30"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Chave Pix" icon={<KeyRound className="h-4 w-4" />} value={pixKey}
              onChange={(v) => {
                if (pixKeyType === "cpf") setPixKey(formatCPF(v));
                else if (pixKeyType === "phone") setPixKey(formatPhone(v));
                else setPixKey(v);
                clearErr("pixKey");
              }}
              placeholder={pixKeyType === "cpf" ? "000.000.000-00" : pixKeyType === "email" ? "seu@email.com" : pixKeyType === "phone" ? "(11) 99999-0000" : "chave aleatória"}
              error={errors.pixKey} />
            <Field label="Nome do favorecido" icon={<User className="h-4 w-4" />} value={pixHolderName} onChange={(v) => { setPixHolderName(v); clearErr("pixHolder"); }} placeholder="Como cadastrado no banco" error={errors.pixHolder} />

            <div className="rounded-xl border bg-muted/30 p-4 space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Resumo</p>
              <Row label="Categoria" value={CATEGORIES.find((c) => c.id === category)?.label || ""} />
              <Row label="Veículo" value={`${vehicleBrand} ${vehicleModel} ${vehicleYear}`} />
              <Row label="Placa" value={vehiclePlate} />
            </div>

            <button onClick={next} disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enviar para análise <CheckCircle2 className="h-4 w-4" /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Auxiliares
interface FieldProps {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string; type?: string; maxLength?: number; inputMode?: any;
}
const Field = ({ label, icon, value, onChange, placeholder, error, type = "text", maxLength, inputMode }: FieldProps) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <div className={`mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 ${error ? "border-destructive" : "focus-within:border-primary"}`}>
      <span className="text-muted-foreground">{icon}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} className="flex-1 bg-transparent text-sm outline-none" />
    </div>
    {error && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {error}</p>}
  </div>
);
const NextBtn = ({ onClick, loading, disabled }: { onClick: () => void; loading: boolean; disabled?: boolean }) => (
  <button onClick={onClick} disabled={loading || disabled}
    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continuar <ArrowRight className="h-4 w-4" /></>}
  </button>
);
const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-medium truncate ml-2">{value || "—"}</span></div>
);

export default BecomeDriver;
