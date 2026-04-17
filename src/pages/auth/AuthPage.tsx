import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Mail, Lock, User, Phone, FileText, Camera, ArrowLeft, ArrowRight, Bike, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { validateCPF, formatCPF, formatPhone, formatPlate } from "@/lib/validators";
import { toast } from "sonner";

type AuthMode = "login" | "register";
type UserType = "passenger" | "driver";
type RegisterStep = 1 | 2 | 3;

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [userType, setUserType] = useState<UserType>("passenger");
  const [step, setStep] = useState<RegisterStep>(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [category, setCategory] = useState<string>("car");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

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
    navigate(userType === "passenger" ? "/passenger" : "/driver");
  };

  const handleRegisterStep = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === 1) {
      // Validate CPF
      const cleanCpf = cpf.replace(/\D/g, "");
      if (!validateCPF(cleanCpf)) {
        setCpfError("CPF inválido. Verifique os dígitos.");
        return;
      }
      if (!fullName.trim() || fullName.trim().length < 3) {
        toast.error("Informe seu nome completo");
        return;
      }
      if (password.length < 8) {
        toast.error("A senha deve ter no mínimo 8 caracteres");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      // For now skip actual OTP/selfie — go to step 3
      if (userType === "passenger") {
        // Passenger: finalize at step 2
        await finalizeRegistration();
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      await finalizeRegistration();
    }
  };

  const finalizeRegistration = async () => {
    setIsLoading(true);
    const cleanCpf = cpf.replace(/\D/g, "");
    const cleanPhone = phone.replace(/\D/g, "");

    const metadata: Record<string, string> = {
      full_name: fullName.trim(),
      cpf: cleanCpf,
      phone: cleanPhone,
      user_type: userType,
    };

    if (userType === "driver") {
      metadata.category = category;
      metadata.vehicle_model = vehicleModel;
      metadata.vehicle_color = vehicleColor;
      metadata.vehicle_plate = vehiclePlate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    }

    const { error } = await signUp(email, password, metadata);
    setIsLoading(false);

    if (error) {
      if (error.message?.includes("already registered")) {
        toast.error("Este email já está cadastrado");
      } else {
        toast.error("Erro no cadastro: " + error.message);
      }
      return;
    }

    toast.success("Conta criada com sucesso!");
    navigate(userType === "passenger" ? "/passenger" : "/driver");
  };

  const maxSteps = userType === "passenger" ? 2 : 3;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-gradient-primary p-6 pb-10">
        <button
          onClick={() => {
            if (mode === "register" && step > 1) setStep((s) => (s - 1) as RegisterStep);
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
              {mode === "login" ? "Entre na sua conta" : `Cadastro - Etapa ${step}/${maxSteps}`}
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
              onClick={() => { setMode(m.id); setStep(1); }}
              className={`pb-2 text-sm font-semibold transition-colors ${
                mode === m.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

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
              Entrar como {userType === "passenger" ? "Passageiro" : "Motorista"}
            </button>
          </form>
        )}

        {/* REGISTER */}
        {mode === "register" && (
          <form onSubmit={handleRegisterStep} className="space-y-4 animate-fade-in">
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
                  <p className="mt-1 text-[10px] text-muted-foreground">Apenas 1 conta por CPF é permitida</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required />
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
                  <label className="text-xs font-medium text-muted-foreground">Senha</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <input type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" required minLength={8} />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="rounded-xl bg-info/10 border border-info/30 p-4">
                  <p className="text-sm font-semibold text-info">Verificação de identidade</p>
                  <p className="text-xs text-muted-foreground mt-1">Precisamos verificar sua identidade para sua segurança.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Selfie de verificação</label>
                  <button type="button" className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background py-8 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    <Camera className="h-5 w-5" /> Tirar selfie
                  </button>
                  <p className="mt-1 text-[10px] text-muted-foreground">Upload de selfie será implementado com storage</p>
                </div>
                {userType === "driver" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">CNH (frente)</label>
                      <button type="button" className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background py-6 text-sm text-muted-foreground hover:border-primary">
                        <Camera className="h-5 w-5" /> Fotografar CNH (frente)
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">CNH (verso)</label>
                      <button type="button" className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background py-6 text-sm text-muted-foreground hover:border-primary">
                        <Camera className="h-5 w-5" /> Fotografar CNH (verso)
                      </button>
                    </div>
                    <div className="rounded-xl bg-warning/10 border border-warning/30 p-3">
                      <p className="text-xs font-semibold text-warning">CNH com EAR obrigatória</p>
                      <p className="text-[10px] text-muted-foreground">Sua CNH deve ter a observação EAR (Exerce Atividade Remunerada).</p>
                    </div>
                  </>
                )}
              </>
            )}

            {step === 3 && userType === "driver" && (
              <>
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                  <p className="text-sm font-semibold">Dados do veículo</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <div className="mt-1 flex gap-2">
                    {[
                      { id: "moto", label: "Moto", icon: Bike },
                      { id: "car", label: "Carro", icon: Car },
                      { id: "premium", label: "Premium", icon: Crown },
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
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Modelo do veículo</label>
                  <div className="mt-1 rounded-xl border bg-background px-3 py-2.5">
                    <input type="text" placeholder="Ex: Toyota Corolla 2022" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} className="w-full bg-transparent text-sm outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cor</label>
                  <div className="mt-1 rounded-xl border bg-background px-3 py-2.5">
                    <input type="text" placeholder="Ex: Prata" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} className="w-full bg-transparent text-sm outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Placa</label>
                  <div className="mt-1 rounded-xl border bg-background px-3 py-2.5">
                    <input type="text" placeholder="Ex: ABC-1D23" value={vehiclePlate} onChange={(e) => setVehiclePlate(formatPlate(e.target.value))} className="w-full bg-transparent text-sm outline-none" required maxLength={8} />
                  </div>
                </div>
              </>
            )}

            {/* Progress dots */}
            <div className="flex justify-center gap-2 py-2">
              {Array.from({ length: maxSteps }).map((_, i) => (
                <div key={i} className={`h-2 rounded-full transition-all ${step === i + 1 ? "w-6 bg-primary" : "w-2 bg-muted"}`} />
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
