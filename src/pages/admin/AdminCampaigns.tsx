import { useEffect, useState } from "react";
import { Plus, Loader2, Megaphone } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";

const AdminCampaigns = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "discount", value: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    if (data) setCampaigns(data);
  };

  useEffect(() => { fetch_(); }, []);
  useRealtimeRefresh("campaigns", fetch_, "admin-campaigns");

  const create = async () => {
    if (!form.name || !form.value) { toast.error("Preencha nome e valor"); return; }
    setSaving(true);
    await supabase.from("campaigns").insert({ name: form.name, type: form.type, value: parseFloat(form.value), description: form.description });
    setSaving(false);
    toast.success("Campanha criada!");
    setShowForm(false);
    setForm({ name: "", type: "discount", value: "", description: "" });
    fetch_();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("campaigns").update({ active: !active }).eq("id", id);
    toast.success(active ? "Campanha desativada" : "Campanha ativada");
    fetch_();
  };

  return (
    <AdminLayout title="Campanhas" actions={
      <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
        <Plus className="h-3.5 w-3.5" /> Nova campanha
      </button>
    }>
      {showForm && (
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da campanha" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
          <div className="flex gap-2">
            {["discount", "cashback", "bonus"].map((t) => (
              <button key={t} onClick={() => setForm({ ...form, type: t })} className={`rounded-lg px-3 py-2 text-xs font-medium ${form.type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {t === "discount" ? "Desconto" : t === "cashback" ? "Cashback" : "Bônus"}
              </button>
            ))}
          </div>
          <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Valor (% ou R$)" type="number" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
          <button onClick={create} disabled={saving} className="rounded-xl bg-gradient-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar
          </button>
        </div>
      )}

      {campaigns.length === 0 && !showForm && (
        <EmptyState icon={Megaphone} title="Nenhuma campanha criada" description="Lance campanhas para engajar motoristas e passageiros." />
      )}
      {campaigns.map((c) => (
        <div key={c.id} className={`rounded-2xl border bg-card p-5 shadow-sm ${!c.active ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-bold">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.type === "discount" ? "Desconto" : c.type === "cashback" ? "Cashback" : "Bônus"} • {c.value}%</p>
            </div>
            <button onClick={() => toggle(c.id, c.active)} className={`rounded-full px-3 py-1 text-xs font-bold ${c.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {c.active ? "Ativa" : "Inativa"}
            </button>
          </div>
          {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
        </div>
      ))}
    </AdminLayout>
  );
};

export default AdminCampaigns;
