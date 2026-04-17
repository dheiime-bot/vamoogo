import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMaster } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, ShieldAlert, Loader2 } from "lucide-react";

interface StaffRow {
  id: string; user_id: string; full_name: string; email: string;
  phone: string | null; status: string; created_at: string;
  roles?: string[];
}
interface Permission { id: string; module: string; action: string; description: string | null; }

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", blocked: "Bloqueado", pending: "Pendente", suspended: "Suspenso",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default", inactive: "secondary", blocked: "destructive", pending: "outline", suspended: "destructive",
};

const AdminStaff = () => {
  const { user } = useAuth();
  const isMaster = useIsMaster();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", password: "",
    role: "admin" as "admin" | "master", status: "active",
  });
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setLoading(true);
    const [{ data: staffData }, { data: permsData }] = await Promise.all([
      supabase.from("staff_users").select("*").order("created_at", { ascending: false }),
      supabase.from("permissions").select("*").order("module").order("action"),
    ]);
    setStaff((staffData ?? []) as StaffRow[]);
    setPermissions((permsData ?? []) as Permission[]);
    setLoading(false);
  };

  useEffect(() => { if (isMaster) loadData(); else setLoading(false); }, [isMaster]);

  const togglePerm = (id: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateStatus = async (row: StaffRow, status: string) => {
    const { error } = await supabase.from("staff_users").update({ status }).eq("id", row.id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success(`Status atualizado para ${STATUS_LABELS[status]}`);
    await supabase.from("audit_logs").insert({
      admin_id: user!.id, action: "update_staff_status",
      entity_type: "staff_users", entity_id: row.id, details: { from: row.status, to: status },
    });
    loadData();
  };

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      toast.error("Preencha nome, e-mail e senha"); return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-staff-user", {
      body: {
        email: form.email, password: form.password, full_name: form.full_name,
        phone: form.phone || undefined, role: form.role, status: form.status,
        permission_ids: Array.from(selectedPerms),
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Falha ao criar funcionário");
      return;
    }
    toast.success("Funcionário criado com sucesso");
    setOpen(false);
    setForm({ full_name: "", email: "", phone: "", password: "", role: "admin", status: "active" });
    setSelectedPerms(new Set());
    loadData();
  };

  if (!isMaster) {
    return (
      <AdminLayout title="Funcionários internos">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive mb-3" />
          <h3 className="text-lg font-semibold">Acesso restrito</h3>
          <p className="text-sm text-muted-foreground">Apenas o usuário master pode acessar a gestão de funcionários internos.</p>
        </div>
      </AdminLayout>
    );
  }

  // agrupa permissões por módulo
  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p); return acc;
  }, {});

  return (
    <AdminLayout
      title="Funcionários internos"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Novo funcionário</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Cadastrar funcionário interno</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Senha temporária</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="master">Master (acesso total)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-2">
                <Label className="text-sm">Permissões extras (opcional — somam-se às do tipo)</Label>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border p-3 space-y-3">
                  {Object.entries(grouped).map(([mod, perms]) => (
                    <div key={mod}>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{mod}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {perms.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox checked={selectedPerms.has(p.id)} onCheckedChange={() => togglePerm(p.id)} />
                            <span>{p.action}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar funcionário
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhum funcionário cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[s.status] ?? "secondary"}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Select value={s.status} onValueChange={(v) => updateStatus(s, v)}>
                      <SelectTrigger className="w-[140px] h-8 ml-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminStaff;
