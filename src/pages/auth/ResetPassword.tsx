import VamooLogo from "@/components/shared/VamooLogo";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import vamooIcon from "@/assets/vamoo-icon.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Senha deve ter no mínimo 8 caracteres, com letras e números.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateErr) {
      setError("Erro ao redefinir senha: " + updateErr.message);
      return;
    }
    setDone(true);
    toast.success("Senha redefinida com sucesso!");
    await supabase.auth.signOut();
    setTimeout(() => navigate("/auth"), 1500);
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
            <h1 className="text-2xl font-display font-extrabold text-foreground">Redefinir senha</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Defina uma nova senha para sua conta.
            </p>
          </div>

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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-lg bg-info/10 border border-info/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres, contendo letras e números.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">Nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm" className="text-sm font-medium text-foreground">Confirmar nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repita a senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                    minLength={8}
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
                    Salvando...
                  </>
                ) : (
                  "Salvar nova senha"
                )}
              </Button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border flex flex-col items-center gap-2">
            <button
              onClick={() => navigate("/auth")}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              ← Voltar ao login
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

export default ResetPassword;
