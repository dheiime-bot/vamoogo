import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Mail, Lock, User, Phone, FileText, ArrowLeft, ArrowRight, Bike, Sparkles, Loader2, Calendar, KeyRound, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, formatCPF, formatPhone, formatPlate } from "@/lib/validators";
import DocumentUpload from "@/components/auth/DocumentUpload";
import { toast } from "sonner";

type AuthMode = "login" | "register";
type UserType = "passenger" | "driver";

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [userType, setUserType] = useState<UserType>("passenger");
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cpfError, setCpfError] = useState("");

  // Selfie (passageiro e motorista)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  // Veículo
  const [category, setCategory] = useState<string>("economico");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

  // Documentos motorista
  const [cnhNumber, setCnhNumber] = useState("");
  const [cnhFrontUrl, setCnhFrontUrl] = useState<string | null>(null);
  const [cnhBackUrl, setCnhBackUrl] = useState<string | null>(null);
  const [crlvUrl, setCrlvUrl] = useState<string | null>(null);
  const [selfieDocUrl, setSelfieDocUrl] = useState<string | null>(null);

  // Pix
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixHolderName, setPixHolderName] = useState("");

  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    setCpf(formatted);
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 11) {
      setCpfError(validateCPF(cleaned) ? "" : "CPF inválido");
    } else {
      setCpfError("");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      toast.error("Erro ao entrar: " + error.message);
      return;
    }
    toast.success("Login realizado!");
    // O redirecionamento real é feito dentro de cada home (ex: DriverHome bloqueia se não aprovado)
    navigate("/passenger");
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Digite seu e-mail no campo acima para recuperar a senha");
      return;
    }
    setIsLoading(true);
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setIsLoading(false);
    if (error) {
      toast.error("Erro ao enviar e-mail: " + error.message);
      return;
    }
    toast.success("Enviamos um link de recuperação para seu e-mail. Verifique a caixa de entrada.");
  };

  const validateStep1 = (): boolean => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (!validateCPF(cleanCpf)) {
      setCpfError("CPF inválido");
      toast.error("CPF inválido");
      return false;
    }
    if (!fullName.trim() || fullName.trim().length < 3) {
      toast.error("Informe seu nome completo");
      return false;
    }
    if (!birthDate) {
      toast.error("Informe sua data de nascimento");
      return false;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Telefone inválido");
      return false;
    }
    if (!email.includes("@")) {
      toast.error("E-mail inválido");
      return false;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      toast.error("Senha deve ter no mínimo 8 caracteres, com letras e números");
      return false;
    }
    return true;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && !validateStep1()) return;

    if (step === 2 && !selfieUrl) {
      toast.error("Tire sua selfie para continuar");
      return;
    }

    if (userType === "passenger" && step === 2) {
      finalizeRegistration();
      return;
    }

    if (userType === "driver") {
      if (step === 3 && (!vehicleBrand || !vehicleModel || !vehicleColor || !vehiclePlate || !vehicleYear)) {
        toast.error("Preencha todos os dados do veículo");
        return;
      }
      if (step === 4 && (!cnhNumber || !cnhFrontUrl || !cnhBackUrl || !crlvUrl || !selfieDocUrl)) {
        toast.error("Envie todos os documentos");
        return;
      }
      if (step === 5) {
        if (!pixKey || !pixHolderName) {
          toast.error("Preencha os dados Pix");
          return;
        }
        finalizeRegistration();
        return;
      }
    }

    setStep((s) => s + 1);
  };

  const finalizeRegistration = async () => {
    setIsLoading(true);
    const cleanCpf = cpf.replace(/\D/g, "");
    const cleanPhone = phone.replace(/\D/g, "");

    // Pré-checagem amigável de duplicidade (CPF)
    const { data: dup } = await supabase.from("profiles").select("id").eq("cpf", cleanCpf).maybeSingle();
    if (dup) {
      setIsLoading(false);
      toast.error("Já existe uma conta com este CPF");
      return;
    }

    const metadata: Record<string, string> = {
      full_name: fullName.trim(),
      cpf: cleanCpf,
      phone: cleanPhone,
      birth_date: birthDate,
      user_type: userType,
      selfie_signup_url: selfieUrl || "",
    };

    if (userType === "driver") {
      metadata.category = category;
      metadata.vehicle_brand = vehicleBrand;
      metadata.vehicle_model = vehicleModel;
      metadata.vehicle_color = vehicleColor;
      metadata.vehicle_year = vehicleYear;
      metadata.vehicle_plate = vehiclePlate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      metadata.cnh_number = cnhNumber;
      metadata.cnh_front_url = cnhFrontUrl || "";
      metadata.cnh_back_url = cnhBackUrl || "";
      metadata.crlv_url = crlvUrl || "";
      metadata.selfie_with_document_url = selfieDocUrl || "";
      metadata.pix_key = pixKey;
      metadata.pix_key_type = pixKeyType;
      metadata.pix_holder_name = pixHolderName;
    }

    const { error } = await signUp(email, password, metadata);
    setIsLoading(false);

    if (error) {
      if (error.message?.includes("already registered") || error.message?.includes("already exists")) {
        toast.error("Este e-mail já está cadastrado");
      } else if (error.message?.includes("duplicate key") && error.message?.includes("phone")) {
        toast.error("Este telefone já está cadastrado");
      } else if (error.message?.includes("duplicate key") && error.message?.includes("plate")) {
        toast.error("Esta placa já está cadastrada");
      } else {
        toast.error("Erro no cadastro: " + error.message);
      }
      return;
    }

    if (userType === "driver") {
      toast.success("Cadastro enviado! Aguarde análise da equipe.");
      navigate("/driver");
    } else {
      toast.success("Conta criada com sucesso!");
      navigate("/passenger");
    }
  };

  const maxSteps = userType === "passenger" ? 2 : 5;
  const stepLabels = userType === "passenger"
    ? ["Dados", "Selfie"]
    : ["Dados", "Selfie", "Veículo", "Documentos", "Pix"];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-gradient-primary p-6 pb-10">
        <button
          onClick={() => {
            if (mode === "register" && step > 1) setStep((s) => s - 1);
            else navigate("/");
          }}
          className="mb-4 text-primary-foreground/80"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/20">
            <Car className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-primary-foreground">Vamoo</h1>
            <p className="text-xs text-primary-foreground/70">
              {mode === "login"
                ? "Entre na sua conta"
                : `Cadastro - ${stepLabels[step - 1]} (${step}/${maxSteps})`}
            </p>
          </div>
        </div>
      </div>

      <div className="relative -mt-4 flex-1 rounded-t-3xl bg-card p-6">
        {/* User type toggle */}
        <div className="mb-5 flex rounded-xl bg-muted p-1">
          {([
            { id: "passenger" as UserType, label: "Passageiro", icon: User },
            { id: "driver" as UserType, label: "Motorista", icon: Car },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => { setUserType(t.id); setStep(1); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                userType === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Auth mode toggle */}
        <div className="mb-5 flex gap-4 border-b">
          {([
            { id: "login" as AuthMode, label: "Entrar" },
            { id: "register" as AuthMode, label: "Cadastrar" },
          ]).map((m) => (
            <button
              key={m.id}
              onClick={() => {
                if (m.id === "register" && userType === "passenger") {
                  navigate("/auth/passenger");
                  return;
                }
                if (m.id === "register" && userType === "driver") {
                  navigate("/auth/driver");
                  return;
                }
                setMode(m.id); setStep(1);
              }}
              className={`pb-2 text-sm font-semibold transition-colors ${
                mode === m.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Quick CTA na tela de login */}
        {mode === "login" && (
          <button
            onClick={() => navigate(userType === "driver" ? "/auth/driver" : "/auth/passenger")}
            className="mb-5 w-full rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            Ainda não tem conta? Cadastre-se como {userType === "driver" ? "motorista" : "passageiro"} →
          </button>
        )}

        {/* LOGIN */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Entrar
            </button>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isLoading}
              className="w-full text-center text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              Esqueci minha senha
            </button>
          </form>
        )}

        {/* REGISTER */}
        {mode === "register" && (
          <form onSubmit={handleNextStep} className="space-y-4 animate-fade-in">
            {/* STEP 1: Dados pessoais */}
            {step === 1 && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nome completo</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">CPF</label>
                  <div className={`mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 ${cpfError ? "border-destructive" : ""}`}>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="000.000.000-00" value={cpf} onChange={(e) => handleCpfChange(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required maxLength={14} />
                  </div>
                  {cpfError && <p className="mt-1 text-xs text-destructive">{cpfError}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data de nascimento</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required max={new Date().toISOString().split("T")[0]} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <input type="tel" placeholder="(11) 99999-0000" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="flex-1 bg-transparent text-sm outline-none" required maxLength={15} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Senha</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <input type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required minLength={8} />
                  </div>
                </div>
              </>
            )}

            {/* STEP 2: Selfie */}
            {step === 2 && (
              <>
                <div className="rounded-xl bg-info/10 border border-info/30 p-4">
                  <p className="text-sm font-semibold text-info">Selfie de verificação</p>
                  <p className="text-xs text-muted-foreground mt-1">Tire uma selfie clara para validarmos sua identidade. Esta foto é permanente.</p>
                </div>
                <DocumentUpload
                  label="Selfie"
                  bucket="selfies"
                  pathPrefix={`signup/${cpf.replace(/\D/g, "")}/selfie`}
                  value={selfieUrl}
                  onChange={setSelfieUrl}
                  capture="user"
                  hint="Aponte a câmera frontal e mantenha o rosto centralizado"
                />
              </>
            )}

            {/* STEP 3: Veículo (motorista) */}
            {step === 3 && userType === "driver" && (
              <>
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                  <p className="text-sm font-semibold">Dados do veículo</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <div className="mt-1 flex gap-2">
                    {[
                      { id: "moto", label: "Moto", icon: Bike },
                      { id: "economico", label: "Econômico", icon: Car },
                      { id: "conforto", label: "Conforto", icon: Sparkles },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 p-3 transition-colors ${
                          category === cat.id ? "border-primary bg-primary/5" : "border-transparent bg-muted hover:border-primary"
                        }`}
                      >
                        <cat.icon className={`h-5 w-5 ${category === cat.id ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-xs font-semibold">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Marca</label>
                    <input type="text" placeholder="Toyota" value={vehicleBrand} onChange={(e) => setVehicleBrand(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Modelo</label>
                    <input type="text" placeholder="Corolla" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Cor</label>
                    <input type="text" placeholder="Prata" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Ano</label>
                    <input type="number" placeholder="2022" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none" required min={2000} max={new Date().getFullYear() + 1} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Placa</label>
                  <input type="text" placeholder="ABC-1D23" value={vehiclePlate} onChange={(e) => setVehiclePlate(formatPlate(e.target.value))} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm uppercase outline-none" required maxLength={8} />
                </div>
              </>
            )}

            {/* STEP 4: Documentos (motorista) */}
            {step === 4 && userType === "driver" && (
              <>
                <div className="rounded-xl bg-warning/10 border border-warning/30 p-3">
                  <p className="text-sm font-semibold text-warning">Documentos para análise</p>
                  <p className="text-[10px] text-muted-foreground mt-1">CNH deve ter EAR (Exerce Atividade Remunerada).</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Número da CNH</label>
                  <input type="text" placeholder="00000000000" value={cnhNumber} onChange={(e) => setCnhNumber(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none" required maxLength={11} />
                </div>
                <DocumentUpload
                  label="CNH (frente)"
                  bucket="driver-documents"
                  pathPrefix={`signup/${cpf.replace(/\D/g, "")}/cnh-frente`}
                  value={cnhFrontUrl}
                  onChange={setCnhFrontUrl}
                  capture="environment"
                />
                <DocumentUpload
                  label="CNH (verso)"
                  bucket="driver-documents"
                  pathPrefix={`signup/${cpf.replace(/\D/g, "")}/cnh-verso`}
                  value={cnhBackUrl}
                  onChange={setCnhBackUrl}
                  capture="environment"
                />
                <DocumentUpload
                  label="Documento do veículo (CRLV)"
                  bucket="driver-documents"
                  pathPrefix={`signup/${cpf.replace(/\D/g, "")}/crlv`}
                  value={crlvUrl}
                  onChange={setCrlvUrl}
                  capture="environment"
                />
                <DocumentUpload
                  label="Selfie segurando documento"
                  bucket="driver-documents"
                  pathPrefix={`signup/${cpf.replace(/\D/g, "")}/selfie-doc`}
                  value={selfieDocUrl}
                  onChange={setSelfieDocUrl}
                  capture="user"
                  hint="Segure sua CNH ao lado do rosto"
                />
              </>
            )}

            {/* STEP 5: Pix (motorista) */}
            {step === 5 && userType === "driver" && (
              <>
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                  <p className="text-sm font-semibold">Dados financeiros (Pix)</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Para receber pagamentos das corridas.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo de chave</label>
                  <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none">
                    <option value="cpf">CPF</option>
                    <option value="phone">Telefone</option>
                    <option value="email">E-mail</option>
                    <option value="random">Chave aleatória</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Chave Pix</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="Sua chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nome do favorecido</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="Como aparece no banco" value={pixHolderName} onChange={(e) => setPixHolderName(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required />
                  </div>
                </div>
              </>
            )}

            {/* Progress dots */}
            <div className="flex justify-center gap-2 py-2">
              {Array.from({ length: maxSteps }).map((_, i) => (
                <div key={i} className={`h-2 rounded-full transition-all ${step === i + 1 ? "w-6 bg-primary" : i + 1 < step ? "w-2 bg-primary/50" : "w-2 bg-muted"}`} />
              ))}
            </div>

            <button type="submit" disabled={isLoading || !!cpfError} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step < maxSteps ? <>Próximo <ArrowRight className="h-4 w-4" /></> : "Finalizar cadastro"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
