import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import HomeFab from "@/components/passageiro/HomeFab";

const PassengerChangePassword = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
      toast.error("Sessão inválida");
      return;
    }
    if (next.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (next !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (current === next) {
      toast.error("A nova senha deve ser diferente da atual");
      return;
    }

    setSaving(true);
    // Reautentica o usuário com a senha atual antes de permitir trocar
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (signErr) {
      setSaving(false);
      toast.error("Senha atual incorreta");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Senha alterada com sucesso");
    setCurrent(""); setNext(""); setConfirm("");
    navigate("/passageiro");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate("/passageiro")}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-display font-bold">Alterar senha</h1>
      </header>

      <form onSubmit={submit} className="px-4 py-6 max-w-md mx-auto space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Lock className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Para sua segurança, confirme sua senha atual antes de definir uma nova.
            A nova senha deve ter no mínimo 6 caracteres.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Senha atual</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Nova senha</label>
          <input
            type={show ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Confirmar nova senha</label>
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
      <HomeFab />
    </div>
  );
};

export default PassengerChangePassword;