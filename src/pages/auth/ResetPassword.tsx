import VamooLogo from "@/components/shared/VamooLogo";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Lock, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Quando o usuário chega pelo link de recuperação, o Supabase dispara
    // o evento PASSWORD_RECOVERY com uma sessão temporária válida só para
    // redefinir a senha. Habilitamos o formulário a partir desse momento.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Caso o evento já tenha disparado antes do listener montar, checamos a sessão.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      toast.error("Senha deve ter no mínimo 8 caracteres, com letras e números");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      toast.error("Erro ao redefinir senha: " + error.message);
      return;
    }
    setDone(true);
    toast.success("Senha redefinida com sucesso!");
    await supabase.auth.signOut();
    setTimeout(() => navigate("/auth"), 1500);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-gradient-primary p-6 pb-10">
        <button onClick={() => navigate("/auth")} className="mb-4 text-primary-foreground/80">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <VamooLogo height={94} className="mb-3" />
          <p className="text-xs text-primary-foreground/70">Redefinir senha</p>
        </div>
      </div>

      <div className="relative -mt-4 flex-1 rounded-t-3xl p-6" style={{ backgroundColor: "#f5fbfb" }}>
        {done ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="text-sm font-semibold">Senha alterada!</p>
            <p className="text-xs text-muted-foreground">Redirecionando para o login…</p>
          </div>
        ) : !ready ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Validando link de recuperação…</p>
            <p className="text-[11px] text-muted-foreground">
              Se nada acontecer em alguns segundos, peça um novo link em "Esqueci minha senha".
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
            <div className="rounded-xl bg-info/10 border border-info/30 p-3">
              <p className="text-xs text-muted-foreground">
                Defina uma nova senha com no mínimo 8 caracteres, contendo letras e números.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nova senha</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Confirmar nova senha</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Repita a senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar nova senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
