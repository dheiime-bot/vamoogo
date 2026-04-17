import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MoreVertical, Eye, FileText, CheckCircle, XCircle, FileWarning,
  Pencil, Ban, Unlock, PauseCircle, PlayCircle, Car, DollarSign, Star,
  CreditCard, MessageSquare, History, Trash2, ShieldCheck, RotateCw, WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  driver: any; // joined with .profiles
  onView: () => void;
  onChanged: () => void;
}

type DialogKind =
  | null | "edit" | "approve" | "reject" | "request_docs" | "block" | "unblock"
  | "suspend" | "online_block" | "online_unblock" | "message" | "delete"
  | "password" | "status" | "logs";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "em_analise", label: "Em análise" },
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
  { value: "pendente_documentos", label: "Pendente de documentos" },
  { value: "blocked", label: "Bloqueado" },
];

const DriverActionsMenu = ({ driver, onView, onChanged }: Props) => {
  const navigate = useNavigate();
  const { roles, user } = useAuth();
  const isMaster = roles.includes("master");
  const isAdmin = isMaster || roles.includes("admin");

  const profile = driver.profiles || {};
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [vehicleBrand, setVehicleBrand] = useState(driver.vehicle_brand || "");
  const [vehicleModel, setVehicleModel] = useState(driver.vehicle_model || "");
  const [vehicleColor, setVehicleColor] = useState(driver.vehicle_color || "");
  const [vehiclePlate, setVehiclePlate] = useState(driver.vehicle_plate || "");
  const [category, setCategory] = useState(driver.category || "economico");
  const [pixKey, setPixKey] = useState(driver.pix_key || "");
  const [pixKeyType, setPixKeyType] = useState(driver.pix_key_type || "cpf");

  const [reason, setReason] = useState("");
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [newStatus, setNewStatus] = useState<string>(driver.status || "em_analise");

  const close = () => {
    setDialog(null); setReason(""); setMsgTitle(""); setMsgBody("");
  };

  const sendNotification = async (title: string, message: string) => {
    await supabase.from("notifications").insert({
      user_id: driver.user_id, type: "driver_status", title, message, link: "/driver/status",
    });
  };

  const updateDriverStatus = async (status: string, message?: string) => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("drivers").update({
      status: status as any,
      analysis_message: message ?? null,
      analyzed_at: new Date().toISOString(),
      analyzed_by: user.id,
    }).eq("user_id", driver.user_id);
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);

    const titles: Record<string, string> = {
      aprovado: "Cadastro aprovado! 🎉",
      reprovado: "Cadastro reprovado",
      pendente_documentos: "Documentos pendentes",
      blocked: "Conta bloqueada",
      em_analise: "Cadastro em análise",
    };
    await sendNotification(titles[status] || "Status atualizado", message || "");
    toast.success("Status atualizado");
    close(); onChanged();
  };

  const handleEdit = async () => {
    setBusy(true);
    const profPromise = supabase.from("profiles")
      .update({ full_name: fullName, email, phone })
      .eq("user_id", driver.user_id);
    const drvPromise = supabase.from("drivers").update({
      vehicle_brand: vehicleBrand, vehicle_model: vehicleModel, vehicle_color: vehicleColor,
      vehicle_plate: vehiclePlate, category: category as any,
      pix_key: pixKey, pix_key_type: pixKeyType,
    }).eq("user_id", driver.user_id);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([profPromise, drvPromise]);
    setBusy(false);
    if (e1 || e2) return toast.error("Erro ao salvar: " + (e1?.message || e2?.message));
    toast.success("Dados atualizados");
    close(); onChanged();
  };

  const handleSuspend = async () => updateDriverStatus("pendente_documentos", reason || "Conta suspensa para análise");

  const handleOnlineBlock = async (block: boolean) => {
    setBusy(true);
    const { error } = await supabase.from("drivers")
      .update({ online_blocked: block, online_blocked_reason: block ? (reason || null) : null })
      .eq("user_id", driver.user_id);
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);
    if (block) {
      // Força ficar offline já
      await supabase.from("driver_locations").update({ is_online: false }).eq("driver_id", driver.user_id);
      await sendNotification("Você foi impedido de ficar online", reason || "Entre em contato com o suporte.");
    } else {
      await sendNotification("Bloqueio operacional removido", "Você já pode ficar online novamente.");
    }
    toast.success(block ? "Motorista impedido de ficar online" : "Bloqueio operacional removido");
    close(); onChanged();
  };

  const handleMessage = async () => {
    if (!msgTitle.trim() || !msgBody.trim()) return toast.error("Preencha título e mensagem");
    setBusy(true);
    const { error } = await supabase.rpc("admin_send_message", {
      _user_id: driver.user_id, _title: msgTitle.trim(), _message: msgBody.trim(),
    });
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Mensagem enviada");
    close();
  };

  const handleDelete = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_user", { _user_id: driver.user_id });
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Conta excluída");
    close(); onChanged();
  };

  const handleResetPassword = async () => {
    if (!profile.email) return toast.error("Motorista sem e-mail cadastrado");
    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo });
    setBusy(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("E-mail de redefinição enviado");
    close();
  };

  const isApproved = driver.status === "aprovado" || driver.status === "approved";
  const isBlocked = driver.status === "blocked";
  const onlineBlocked = !!driver.online_blocked;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button onClick={(e) => e.stopPropagation()} className="rounded-lg p-1.5 hover:bg-muted" title="Ações">
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel className="text-xs">Ações</DropdownMenuLabel>

          <DropdownMenuItem onClick={onView}><Eye className="mr-2 h-4 w-4" /> Visualizar detalhes</DropdownMenuItem>
          <DropdownMenuItem onClick={onView}><FileText className="mr-2 h-4 w-4" /> Ver documentos</DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] text-muted-foreground">Análise de cadastro</DropdownMenuLabel>
              {!isApproved && (
                <DropdownMenuItem onClick={() => setDialog("approve")} className="text-success">
                  <CheckCircle className="mr-2 h-4 w-4" /> Aprovar cadastro
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setDialog("request_docs")}>
                <FileWarning className="mr-2 h-4 w-4 text-info" /> Solicitar correção
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("reject")} className="text-warning">
                <XCircle className="mr-2 h-4 w-4" /> Reprovar cadastro
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger><RotateCw className="mr-2 h-4 w-4" /> Alterar status manual</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {STATUS_OPTIONS.map((s) => (
                      <DropdownMenuItem key={s.value} onClick={() => { setNewStatus(s.value); setDialog("status"); }}>
                        {s.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </>
          )}

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] text-muted-foreground">Edição</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setDialog("edit")}>
                <Pencil className="mr-2 h-4 w-4" /> Editar dados
              </DropdownMenuItem>
              {profile.email && (
                <DropdownMenuItem onClick={() => setDialog("password")}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Redefinir senha
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] text-muted-foreground">Histórico</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigate(`/admin/rides?driver=${driver.user_id}`)}>
            <Car className="mr-2 h-4 w-4" /> Ver corridas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/admin/finance?driver=${driver.user_id}`)}>
            <DollarSign className="mr-2 h-4 w-4" /> Ver ganhos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/admin/finance?driver=${driver.user_id}&tab=payments`)}>
            <CreditCard className="mr-2 h-4 w-4" /> Pagamentos recebidos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/admin/rides?driver=${driver.user_id}&tab=ratings`)}>
            <Star className="mr-2 h-4 w-4" /> Ver avaliações
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/admin/audit?entity=${driver.user_id}`)}>
            <History className="mr-2 h-4 w-4" /> Logs / auditoria
          </DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] text-muted-foreground">Operação</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setDialog("message")}>
                <MessageSquare className="mr-2 h-4 w-4" /> Enviar mensagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setReason(driver.online_blocked_reason || ""); setDialog(onlineBlocked ? "online_unblock" : "online_block"); }}>
                {onlineBlocked
                  ? <><PlayCircle className="mr-2 h-4 w-4 text-success" /> Liberar para ficar online</>
                  : <><WifiOff className="mr-2 h-4 w-4 text-warning" /> Impedir de ficar online</>}
              </DropdownMenuItem>
              {!isBlocked && (
                <DropdownMenuItem onClick={() => setDialog("suspend")}>
                  <PauseCircle className="mr-2 h-4 w-4 text-warning" /> Suspender (temporário)
                </DropdownMenuItem>
              )}
              {isBlocked ? (
                <DropdownMenuItem onClick={() => updateDriverStatus("aprovado", "Conta desbloqueada")} className="text-success">
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar dados do motorista</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Nome</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
            <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">CPF não pode ser alterado por aqui.</p>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold mb-2">Veículo</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Marca</Label><Input value={vehicleBrand} onChange={(e) => setVehicleBrand(e.target.value)} /></div>
                <div><Label>Modelo</Label><Input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} /></div>
                <div><Label>Cor</Label><Input value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} /></div>
                <div><Label>Placa</Label><Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} /></div>
              </div>
              <div className="mt-2">
                <Label>Categoria</Label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="moto">Moto</option>
                  <option value="economico">Econômico</option>
                  <option value="conforto">Conforto</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold mb-2">Chave Pix</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo</Label>
                  <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                    <option value="random">Aleatória</option>
                  </select>
                </div>
                <div><Label>Chave</Label><Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={handleEdit} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Salvar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve */}
      <AlertDialog open={dialog === "approve"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar este motorista?</AlertDialogTitle>
            <AlertDialogDescription>Ele poderá ficar online e receber corridas imediatamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => updateDriverStatus("aprovado", "Cadastro aprovado")} disabled={busy} className="bg-success hover:bg-success/90">Aprovar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject */}
      <Dialog open={dialog === "reject"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprovar cadastro</DialogTitle></DialogHeader>
          <Label>Motivo da reprovação (será enviado ao motorista)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Ex: Documentos não conferem com o nome do CPF" />
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={() => reason.trim() ? updateDriverStatus("reprovado", reason.trim()) : toast.error("Informe o motivo")} disabled={busy} className="rounded-lg bg-warning px-4 py-2 text-sm font-medium text-warning-foreground disabled:opacity-50">Reprovar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request docs */}
      <Dialog open={dialog === "request_docs"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar correção / reenviar documentos</DialogTitle></DialogHeader>
          <Label>Quais documentos precisam ser reenviados?</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Ex: CNH ilegível, selfie sem rosto visível, placa divergente" />
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={() => reason.trim() ? updateDriverStatus("pendente_documentos", reason.trim()) : toast.error("Descreva o que precisa")} disabled={busy} className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-info-foreground disabled:opacity-50">Solicitar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status manual */}
      <AlertDialog open={dialog === "status"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar status para "{STATUS_OPTIONS.find(s => s.value === newStatus)?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>O motorista será notificado da mudança.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => updateDriverStatus(newStatus)} disabled={busy}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block */}
      <Dialog open={dialog === "block"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bloquear este motorista?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A conta ficará bloqueada e o motorista não poderá operar.</p>
          <Textarea placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={() => updateDriverStatus("blocked", reason || "Conta bloqueada pelo administrador")} disabled={busy} className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50">Bloquear</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend */}
      <Dialog open={dialog === "suspend"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suspender temporariamente</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Diferente de bloquear: o motorista entra em "pendente de documentos" para análise interna.</p>
          <Textarea placeholder="Motivo da suspensão" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={handleSuspend} disabled={busy} className="rounded-lg bg-warning px-4 py-2 text-sm font-medium text-warning-foreground disabled:opacity-50">Suspender</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Online block */}
      <Dialog open={dialog === "online_block"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Impedir de ficar online</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Bloqueio operacional leve. A conta continua ativa, mas o motorista não pode ativar o status online nem receber corridas.</p>
          <Textarea placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
            <button onClick={() => handleOnlineBlock(true)} disabled={busy} className="rounded-lg bg-warning px-4 py-2 text-sm font-medium text-warning-foreground disabled:opacity-50">Impedir</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === "online_unblock"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar para ficar online?</AlertDialogTitle>
            <AlertDialogDescription>O motorista voltará a poder receber corridas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleOnlineBlock(false)} disabled={busy}>Liberar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password */}
      <AlertDialog open={dialog === "password"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar redefinição de senha?</AlertDialogTitle>
            <AlertDialogDescription>
              Um e-mail será enviado para <b>{profile.email}</b> com o link para nova senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={busy}>Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message */}
      <Dialog open={dialog === "message"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar mensagem ao motorista</DialogTitle></DialogHeader>
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
              Esta ação não pode ser desfeita. O perfil, papéis e dados de motorista serão removidos.
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

export default DriverActionsMenu;
