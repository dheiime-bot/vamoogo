import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Eye, Pencil, Ban, AlertTriangle, Car, CreditCard, Star, MessageSquare, Trash2, Unlock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  passenger: any;
  onView: () => void;
  onChanged: () => void;
}

type DialogKind = null | "edit" | "block" | "unblock" | "suspect" | "message" | "delete" | "password";

const PassengerActionsMenu = ({ passenger, onView, onChanged }: Props) => {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const isMaster = roles.includes("master");
  const isAdmin = isMaster || roles.includes("admin");

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState(passenger.full_name || "");
  const [email, setEmail] = useState(passenger.email || "");
  const [phone, setPhone] = useState(passenger.phone || "");
  const [newPassword, setNewPassword] = useState("");
  const [reason, setReason] = useState("");
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");

  const close = () => { setDialog(null); setReason(""); setMsgTitle(""); setMsgBody(""); setNewPassword(""); };

  const handleEdit = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, email, phone })
      .eq("user_id", passenger.user_id);
    setBusy(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Dados atualizados");
    close(); onChanged();
  };

  const handleBlock = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "bloqueado", blocked_reason: reason || null, blocked_at: new Date().toISOString() })
      .eq("user_id", passenger.user_id);
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Passageiro bloqueado");
    close(); onChanged();
  };

  const handleUnblock = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "ativo", blocked_reason: null, blocked_at: null })
      .eq("user_id", passenger.user_id);
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Passageiro desbloqueado");
    close(); onChanged();
  };

  const handleSuspect = async () => {
    setBusy(true);
    const next = !passenger.is_suspect;
    const { error } = await supabase
      .from("profiles")
      .update({ is_suspect: next, suspect_reason: next ? (reason || null) : null })
      .eq("user_id", passenger.user_id);
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(next ? "Marcado como suspeito" : "Suspeita removida");
    close(); onChanged();
  };

  const handleMessage = async () => {
    if (!msgTitle.trim() || !msgBody.trim()) return toast.error("Preencha título e mensagem");
    setBusy(true);
    const { error } = await supabase.rpc("admin_send_message", {
      _user_id: passenger.user_id,
      _title: msgTitle.trim(),
      _message: msgBody.trim(),
    });
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Mensagem enviada");
    close();
  };

  const handleDelete = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_user", { _user_id: passenger.user_id });
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Conta excluída");
    close(); onChanged();
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) return toast.error("Senha precisa ter pelo menos 6 caracteres");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-set-password", {
      body: { user_id: passenger.user_id, new_password: newPassword },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error("Erro: " + (error?.message || (data as any)?.error));
    toast.success("Senha redefinida com sucesso");
    close();
  };

  const isBlocked = passenger.status === "bloqueado";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button onClick={(e) => e.stopPropagation()} className="rounded-lg p-1.5 hover:bg-muted" title="Ações">
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel className="text-xs">Ações</DropdownMenuLabel>
          <DropdownMenuItem onClick={onView}><Eye className="mr-2 h-4 w-4" /> Visualizar detalhes</DropdownMenuItem>

          {isAdmin && (
            <DropdownMenuItem onClick={() => setDialog("edit")}><Pencil className="mr-2 h-4 w-4" /> Editar dados</DropdownMenuItem>
          )}
          {isAdmin && (
            <DropdownMenuItem onClick={() => setDialog("password")}><ShieldCheck className="mr-2 h-4 w-4" /> Trocar senha</DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate(`/admin/rides?passenger=${passenger.user_id}`)}>
            <Car className="mr-2 h-4 w-4" /> Ver corridas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/admin/finance?passenger=${passenger.user_id}`)}>
            <CreditCard className="mr-2 h-4 w-4" /> Ver pagamentos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/admin/rides?passenger=${passenger.user_id}&tab=ratings`)}>
            <Star className="mr-2 h-4 w-4" /> Ver avaliações
          </DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDialog("message")}>
                <MessageSquare className="mr-2 h-4 w-4" /> Enviar mensagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setReason(passenger.suspect_reason || ""); setDialog("suspect"); }}>
                <AlertTriangle className="mr-2 h-4 w-4 text-warning" />
                {passenger.is_suspect ? "Remover suspeita" : "Marcar como suspeito"}
              </DropdownMenuItem>
              {isBlocked ? (
                <DropdownMenuItem onClick={() => setDialog("unblock")} className="text-success">
                  <Unlock className="mr-2 h-4 w-4" /> Desbloquear
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setDialog("block")} className="text-destructive">
                  <Ban className="mr-2 h-4 w-4" /> Bloquear
                </DropdownMenuItem>
              )}
            </>
          )}

          {isMaster && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDialog("delete")} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir conta
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog */}
      <Dialog open={dialog === "edit"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar dados do passageiro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">CPF não pode ser alterado.</p>
          </div>
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={handleEdit} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Salvar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trocar senha direto */}
      <Dialog open={dialog === "password"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Trocar senha do passageiro</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              A nova senha entra em vigor imediatamente. O usuário será notificado e poderá entrar com ela. Link por e-mail só é enviado quando o próprio usuário pedir "Esqueci minha senha" no app.
            </p>
            <Label>Nova senha (mínimo 6 caracteres)</Label>
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Ex: SenhaTemp@2025" autoComplete="new-password" />
          </div>
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={handleResetPassword} disabled={busy || newPassword.length < 6} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Trocar senha</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block */}
      <AlertDialog open={dialog === "block"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear este passageiro?</AlertDialogTitle>
            <AlertDialogDescription>Ele não poderá solicitar novas corridas até ser desbloqueado.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlock} disabled={busy} className="bg-destructive hover:bg-destructive/90">Bloquear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock */}
      <AlertDialog open={dialog === "unblock"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear este passageiro?</AlertDialogTitle>
            <AlertDialogDescription>Ele voltará a solicitar corridas normalmente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblock} disabled={busy}>Desbloquear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspect */}
      <Dialog open={dialog === "suspect"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{passenger.is_suspect ? "Remover marcação de suspeito" : "Marcar como suspeito"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {passenger.is_suspect
                ? "A flag de suspeita será removida deste passageiro."
                : "Adiciona uma flag interna sem bloquear o usuário. Útil para investigação."}
            </p>
            {!passenger.is_suspect && (
              <Textarea placeholder="Motivo (ex: comportamento estranho, denúncia, fraude)" value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
          </div>
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={handleSuspect} disabled={busy} className="rounded-lg bg-warning px-4 py-2 text-sm font-medium text-warning-foreground disabled:opacity-50">Confirmar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message */}
      <Dialog open={dialog === "message"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar mensagem ao passageiro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={msgTitle} onChange={(e) => setMsgTitle(e.target.value)} placeholder="Ex: Aviso importante" /></div>
            <div><Label>Mensagem</Label><Textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} rows={4} /></div>
          </div>
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={handleMessage} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Enviar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={dialog === "delete"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir conta definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados de perfil e papéis do usuário serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PassengerActionsMenu;
