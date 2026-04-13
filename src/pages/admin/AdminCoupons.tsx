import { useEffect, useState } from "react";
import { Plus, Loader2, Copy } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", discount_type: "percentage", discount_value: "", max_uses: "100", min_fare: "0" });
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (data) setCoupons(data);
  };

  useEffect(() => { fetch_(); }, []);

  const create = async () => {
    if (!form.code || !form.discount_value) { toast.error("Preencha código e valor"); return; }
    setSaving(true);
    const { error } = await supabase.from("coupons").insert({
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_uses: parseInt(form.max_uses) || 100,
      min_fare: parseFloat(form.min_fare) || 0,
    });
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Cupom criado!");
    setShowForm(false);
    setForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "100", min_fare: "0" });
    fetch_();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("coupons").update({ active: !active }).eq("id", id);
    fetch_();
  };

  return (
    <AdminLayout title="Cupons" actions={
      <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
        <Plus className="h-3.5 w-3.5" /> Novo cupom
      </button>
    }>
      {showForm && (
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Código (ex: VAMOO10)" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none uppercase" />
          <div className="flex gap-2">
            {["percentage", "fixed"].map((t) => (
              <button key={t} onClick={() => setForm({ ...form, discount_type: t })} className={`rounded-lg px-3 py-2 text-xs font-medium ${form.discount_type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {t === "percentage" ? "Porcentagem %" : "Valor fixo R$"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder="Valor" type="number" className="rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
            <input value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Usos máx" type="number" className="rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
            <input value={form.min_fare} onChange={(e) => setForm({ ...form, min_fare: e.target.value })} placeholder="Tarifa mín" type="number" className="rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
          </div>
          <button onClick={create} disabled={saving} className="rounded-xl bg-gradient-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar cupom
          </button>
        </div>
      )}

      {coupons.length === 0 && !showForm && <p className="text-center py-8 text-sm text-muted-foreground">Nenhum cupom criado</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {coupons.map((c) => (
          <div key={c.id} className={`rounded-2xl border bg-card p-4 shadow-sm ${!c.active ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-mono font-bold text-primary">{c.code}</span>
              <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copiado!"); }}>
                <Copy className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm font-bold">{c.discount_type === "percentage" ? `${c.discount_value}%` : `R$ ${c.discount_value}`} off</p>
            <p className="text-xs text-muted-foreground">{c.used_count}/{c.max_uses} usos • Min R$ {c.min_fare}</p>
            <button onClick={() => toggle(c.id, c.active)} className={`mt-2 rounded-full px-3 py-1 text-xs font-bold ${c.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {c.active ? "Ativo" : "Inativo"}
            </button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminCoupons;
