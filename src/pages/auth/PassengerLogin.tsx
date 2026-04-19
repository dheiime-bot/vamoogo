import VamooLogo from "@/components/shared/VamooLogo";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Mail, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PassengerLogin = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setIsLoading(false);
      toast.error("Erro ao entrar: " + error.message);
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
        setIsLoading(false);
        toast.error("Esta conta não é de passageiro. Use o login de motorista.");
        return;
      }
    }

    setIsLoading(false);
    toast.success("Bem-vindo!");
    navigate("/passenger");
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Digite seu e-mail no campo acima");
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
    toast.success("Enviamos um link de recuperação para seu e-mail.");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-gradient-primary p-6 pb-10">
        <button onClick={() => navigate("/auth")} className="mb-4 text-primary-foreground/80">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <VamooLogo height={72} className="mb-3" />
          <p className="text-sm font-semibold text-primary-foreground">Passageiro</p>
          <p className="text-xs text-primary-foreground/70">Entre na sua conta</p>
        </div>
      </div>

      <div className="relative -mt-4 flex-1 rounded-t-3xl p-6" style={{ backgroundColor: "#f5fbfb" }}>
        <button
          onClick={() => navigate("/auth/passenger")}
          className="mb-5 w-full rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          Ainda não tem conta? Cadastre-se como passageiro →
        </button>

        <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Senha</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Entrar como Passageiro
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

        <div className="mt-6 border-t pt-4 text-center">
          <button
            onClick={() => navigate("/auth/driver/login")}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            É motorista? Entrar no app de motorista →
          </button>
        </div>
      </div>
    </div>
  );
};

export default PassengerLogin;
