import VamooLogo from "@/components/shared/VamooLogo";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import vamooIcon from "@/assets/vamoo-icon.png";

const PassengerLogin = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    const { error: signErr } = await signIn(email, password);
    if (signErr) {
      setLoading(false);
      setError("Erro ao entrar: " + signErr.message);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const loggedUser = authData.user;
    if (loggedUser) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", loggedUser.id);
      const roleList = (roleRows || []).map((r: any) => r.role);
      if (!roleList.includes("passenger") && !roleList.includes("admin") && !roleList.includes("master") && !roleList.includes("driver")) {
        await supabase.auth.signOut();
        setLoading(false);
        setError("Esta conta não é de passageiro. Use o login de motorista.");
        return;
      }
    }

    setLoading(false);
    toast.success("Bem-vindo!");
    navigate("/passageiro");
  };

  const handleResetPassword = async () => {
    if (!email || !email.includes("@")) {
      setError("Informe seu e-mail acima para receber o link de recuperação.");
      return;
    }
    setLoading(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (resetErr) {
      setError("Erro ao enviar e-mail: " + resetErr.message);
      return;
    }
    toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="border border-border rounded-3xl shadow-xl p-8 sm:p-10" style={{ backgroundColor: "#f5fbfb" }}>
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <VamooLogo height={109} card={false} className="mb-3" />
            <h1 className="text-2xl font-display font-extrabold text-foreground">Passageiro</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Entre na sua conta para pedir corridas.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary text-primary-foreground font-semibold h-11 hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Entrando...
                </>
              ) : (
                "Entrar como Passageiro"
              )}
            </Button>

            <button
              type="button"
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full text-sm text-primary hover:underline font-medium disabled:opacity-50"
            >
              Esqueci minha senha
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border flex flex-col items-center gap-2">
            <button
              onClick={() => navigate("/passageiro/cadastro")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ainda não tem conta? Cadastre-se →
            </button>
            <button
              onClick={() => navigate("/motorista/login")}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              É motorista? Entrar no app de motorista →
            </button>
            <div className="flex items-center gap-2 mt-2">
              <img src={vamooIcon} alt="Vamoo" className="w-5 h-5" />
              <span className="font-display font-bold text-gradient-primary text-sm">Vamoo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PassengerLogin;
