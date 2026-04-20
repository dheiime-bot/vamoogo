import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Users, Car, ListOrdered, ShieldCheck, ShieldAlert, X, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Reason {
  id: string;
  role: "passenger" | "driver";
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  counts_as_punishment: boolean;
}

const emptyReason = (role: "passenger" | "driver"): Reason => ({
  id: "", role, code: "", label: "", description: "",
  sort_order: 50, active: true, counts_as_punishment: true,
});

const CancellationReasonsManager = () => {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Reason | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cancellation_reasons" as any)
      .select("*")
      .order("role", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setReasons((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.code.trim() || !editing.label.trim()) {
      toast.error("Código e título são obrigatórios");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_upsert_cancellation_reason" as any, {
      _id: editing.id || null,
      _role: editing.role,
      _code: editing.code.trim(),
      _label: editing.label.trim(),
      _description: editing.description || "",
      _sort_order: editing.sort_order,
      _active: editing.active,
      _counts_as_punishment: editing.counts_as_punishment,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Motivo atualizado" : "Motivo criado");
    setEditing(null);
    load();
  };

  const remove = async (r: Reason) => {
    if (!confirm(`Excluir o motivo "${r.label}"?`)) return;
    const { error } = await supabase.rpc("admin_delete_cancellation_reason" as any, { _id: r.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Motivo excluído");
    load();
  };

  const toggleActive = async (r: Reason) => {
    const { error } = await supabase.rpc("admin_upsert_cancellation_reason" as any, {
      _id: r.id, _role: r.role, _code: r.code, _label: r.label,
      _description: r.description || "", _sort_order: r.sort_order,
      _active: !r.active, _counts_as_punishment: r.counts_as_punishment,
    });
    if (error) { toast.error(error.message); return; }
    load();
  };

  const renderList = (role: "passenger" | "driver") => {
    const list = reasons.filter((r) => r.role === role);
    return (
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            {role === "passenger" ? <Users className="h-4 w-4 text-primary" /> : <Car className="h-4 w-4 text-info" />}
            Motivos — {role === "passenger" ? "Passageiros" : "Motoristas"}
          </h3>
          <button
            onClick={() => setEditing(emptyReason(role))}
            className="flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-bold hover:opacity-90"
          >
            <Plus className="h-3 w-3" /> Novo
          </button>
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum motivo cadastrado.</p>
        ) : (
          <ul className="divide-y">
            {list.map((r) => (
              <li key={r.id} className="py-2 flex items-center gap-2">
                <span className="w-8 text-center text-[11px] font-mono text-muted-foreground">
                  <ListOrdered className="h-3 w-3 inline" /> {r.sort_order}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-sm font-semibold truncate ${!r.active ? "line-through text-muted-foreground" : ""}`}>
                      {r.label}
                    </p>
                    {!r.active && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                        Inativo
                      </span>
                    )}
                    {r.counts_as_punishment ? (
                      <span className="rounded-full bg-warning/15 text-warning px-1.5 py-0.5 text-[9px] font-bold uppercase flex items-center gap-0.5">
                        <ShieldAlert className="h-2.5 w-2.5" /> Pune
                      </span>
                    ) : (
                      <span className="rounded-full bg-success/15 text-success px-1.5 py-0.5 text-[9px] font-bold uppercase flex items-center gap-0.5">
                        <ShieldCheck className="h-2.5 w-2.5" /> Sem punição
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{r.code}</p>
                </div>
                <button
                  onClick={() => toggleActive(r)}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"
                  title={r.active ? "Desativar" : "Ativar"}
                >
                  {r.active ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setEditing({ ...r })}
                  className="rounded-lg p-1.5 hover:bg-muted"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(r)}
                  className="rounded-lg p-1.5 hover:bg-destructive/10 text-destructive"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando motivos…
      </div>
    );
  }

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4">
        {renderList("passenger")}
        {renderList("driver")}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && !saving && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing?.id ? "Editar motivo" : "Novo motivo"} — {editing?.role === "passenger" ? "Passageiro" : "Motorista"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold">Código (slug)</label>
                  <input
                    value={editing.code}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                    placeholder="long_wait"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Ordem</label>
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Título exibido</label>
                <input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="Motorista está demorando"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Descrição (opcional)</label>
                <textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm min-h-[60px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 cursor-pointer">
                  <span className="text-xs font-semibold">Ativo</span>
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 cursor-pointer">
                  <span className="text-xs font-semibold">Conta como punição</span>
                  <input
                    type="checkbox"
                    checked={editing.counts_as_punishment}
                    onChange={(e) => setEditing({ ...editing, counts_as_punishment: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  className="flex-1 rounded-xl border bg-card py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-4 w-4 inline mr-1" /> Cancelar
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground py-2 text-sm font-bold disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : <Save className="h-4 w-4 inline mr-1" />}
                  {saving ? " Salvando" : " Salvar"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CancellationReasonsManager;