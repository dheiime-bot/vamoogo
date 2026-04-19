import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import vamooIcon from "@/assets/vamoo-icon.png";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { signIn, user, roles, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAdminRedirect, setPendingAdminRedirect] = useState(false);

  useEffect(() => {
    if (!authLoading && user && (roles.includes("admin") || roles.includes("master"))) {
      navigate("/admin", { replace: true });
      return;
    }

    if (!authLoading && pendingAdminRedirect) {
      setLoading(false);
      if (!user || (!roles.includes("admin") && !roles.includes("master"))) {
        setPendingAdminRedirect(false);
        setError("Acesso restrito. Esta área é exclusiva para administradores.");
      }
    }
  }, [authLoading, user, roles, navigate, pendingAdminRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const { error: signErr } = await signIn(email, password);
      if (signErr) {
        setError("Credenciais inválidas.");
        setLoading(false);
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        setError("Falha na autenticação.");
        setLoading(false);
        return;
      }

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const userRoles = (rolesData || []).map((r: any) => r.role);
      const isAdmin = userRoles.includes("admin") || userRoles.includes("master");

      if (!isAdmin) {
        await supabase.auth.signOut();
        setError("Acesso restrito. Esta área é exclusiva para administradores.");
        setLoading(false);
        return;
      }

      setPendingAdminRedirect(true);
      toast.success("Bem-vindo, administrador!");
    } catch (err: any) {
      setError(err?.message || "Erro ao entrar.");
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Informe seu e-mail acima para receber o link de recuperação.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (resetErr) throw resetErr;
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      setError(err?.message || "Erro ao enviar e-mail de recuperação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-card border border-border rounded-3xl shadow-xl p-8 sm:p-10">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <VamooLogo height={56} card={false} className="mb-3" />
            <h1 className="text-2xl font-display font-extrabold text-foreground">Painel Admin</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Acesso restrito. Use suas credenciais de administrador.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@vamoo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Senha
              </label>
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
                "Entrar no painel"
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
            <div className="flex items-center gap-2">
              <img src={vamooIcon} alt="Vamoo" className="w-5 h-5" />
              <span className="font-display font-bold text-gradient-primary text-sm">Vamoo Admin</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Acesso exclusivo para administradores. Novos cadastros são criados pelo painel admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
