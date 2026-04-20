import { useEffect, useState } from "react";
import { Plus, Loader2, Copy, Trash2, TicketPercent, Send, Users, Search, CheckCircle2, MoreVertical, UserPlus, Megaphone } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { toast } from "sonner";
import UserAvatar from "@/components/shared/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AdminCoupons = () => {
  type Tab = "general" | "send";
  const [tab, setTab] = useState<Tab>("general");

  const [coupons, setCoupons] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "", discount_type: "percentage", discount_value: "",
    max_uses: "100", min_fare: "0", expires_at: "",
  });
  const [saving, setSaving] = useState(false);

  // Envio direto
  const [passengers, setPassengers] = useState<any[]>([]);
  const [pSearch, setPSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendForm, setSendForm] = useState({
    code: "", discount_type: "percentage", discount_value: "",
    min_fare: "0", expires_at: "", message: "",
  });
  const [sending, setSending] = useState(false);

  // Listagem dos enviados (passenger_coupons)
  const [sent, setSent] = useState<any[]>([]);
  const [sentSearch, setSentSearch] = useState("");

  const fetch_ = async () => {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (data) setCoupons(data);
  };

  const fetchPassengers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone, selfie_url")
      .eq("user_type", "passenger")
      .order("full_name", { ascending: true })
      .limit(500);
    if (data) setPassengers(data);
  };

  const fetchSent = async () => {
    const { data: rows } = await supabase
      .from("passenger_coupons")
      .select("id, code, discount_type, discount_value, min_fare, expires_at, created_at, used_at, passenger_id, message")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!rows) { setSent([]); return; }
    const ids = Array.from(new Set(rows.map((r: any) => r.passenger_id)));
    let nameMap = new Map<string, { full_name: string; email: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, selfie_url")
        .in("user_id", ids);
      (profs || []).forEach((p: any) => nameMap.set(p.user_id, p));
    }
    setSent(rows.map((r: any) => ({ ...r, _profile: nameMap.get(r.passenger_id) || null })));
  };

  useEffect(() => { fetch_(); fetchPassengers(); fetchSent(); }, []);
  useRealtimeRefresh("coupons", fetch_, "admin-coupons");
  useRealtimeRefresh("passenger_coupons", fetchSent, "admin-sent-coupons");

  const create = async () => {
    if (!form.code || !form.discount_value) { toast.error("Preencha código e valor"); return; }
    setSaving(true);
    const { error } = await supabase.from("coupons").insert({
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_uses: parseInt(form.max_uses) || 100,
      min_fare: parseFloat(form.min_fare) || 0,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    });
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Cupom criado!");
    setShowForm(false);
    setForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "100", min_fare: "0", expires_at: "" });
    fetch_();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("coupons").update({ active: !active }).eq("id", id);
    fetch_();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este cupom?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    toast.success("Cupom excluído");
    fetch_();
  };

  const isExpired = (c: any) => c.expires_at && new Date(c.expires_at) < new Date();

  const filteredPassengers = passengers.filter((p) => {
    const q = pSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.phone || "").toLowerCase().includes(q)
    );
  });

  const filteredSent = sent.filter((r) => {
    const q = sentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (r._profile?.full_name || "").toLowerCase().includes(q) ||
      (r._profile?.email || "").toLowerCase().includes(q) ||
      (r.code || "").toLowerCase().includes(q)
    );
  });

  const toggleSelect = (uid: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid); else n.add(uid);
      return n;
    });
  };
  const selectAllVisible = () => setSelectedIds(new Set(filteredPassengers.map((p) => p.user_id)));
  const clearSelection = () => setSelectedIds(new Set());

  const sendCoupon = async () => {
    if (selectedIds.size === 0) { toast.error("Selecione ao menos um passageiro"); return; }
    if (!sendForm.code || !sendForm.discount_value) { toast.error("Preencha código e valor"); return; }
    setSending(true);
    const { data, error } = await supabase.rpc("admin_send_coupon", {
      _code: sendForm.code.toUpperCase(),
      _discount_type: sendForm.discount_type,
      _discount_value: parseFloat(sendForm.discount_value),
      _min_fare: parseFloat(sendForm.min_fare) || 0,
      _expires_at: sendForm.expires_at ? new Date(sendForm.expires_at).toISOString() : undefined,
      _message: sendForm.message || undefined,
      _passenger_ids: Array.from(selectedIds),
    });
    setSending(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`Cupom enviado para ${data ?? selectedIds.size} passageiro(s)!`);
    setSendForm({ code: "", discount_type: "percentage", discount_value: "", min_fare: "0", expires_at: "", message: "" });
    clearSelection();
    fetchSent();
  };

  // Pré-preenche o formulário de envio direto com um cupom existente e troca para a aba de envio.
  const useCouponForSend = (c: any, mode: "mass" | "individual") => {
    setSendForm({
      code: c.code,
      discount_type: c.discount_type || "percentage",
      discount_value: String(c.discount_value ?? ""),
      min_fare: String(c.min_fare ?? "0"),
      expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : "",
      message: "",
    });
    setTab("send");
    if (mode === "mass") {
      // seleciona todos os passageiros disponíveis após carregar
      setTimeout(() => {
        setSelectedIds(new Set(passengers.map((p) => p.user_id)));
        toast.success(`Cupom ${c.code} pronto para envio em massa (${passengers.length})`);
      }, 0);
    } else {
      clearSelection();
      toast.success(`Cupom ${c.code} pronto. Selecione os passageiros.`);
    }
  };

  return (
    <AdminLayout
      title="Cupons"
      actions={
        tab === "general" ? (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Novo cupom
          </button>
        ) : null
      }
    >
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { id: "general" as Tab, label: "Cupons gerais", icon: TicketPercent },
          { id: "send" as Tab, label: "Envio direto", icon: Send },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && showForm && (
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
            <div>
              <label className="text-[10px] text-muted-foreground">Valor</label>
              <input value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === "percentage" ? "10" : "5.00"} type="number" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Usos máx</label>
              <input value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="100" type="number" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Tarifa mín</label>
              <input value={form.min_fare} onChange={(e) => setForm({ ...form, min_fare: e.target.value })} placeholder="0" type="number" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Validade (opcional)</label>
            <input value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} type="datetime-local" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
          </div>
          <button onClick={create} disabled={saving} className="rounded-xl bg-gradient-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar cupom
          </button>
        </div>
      )}

      {tab === "general" && coupons.length === 0 && !showForm && (
        <EmptyState icon={TicketPercent} title="Nenhum cupom criado" description="Crie cupons promocionais para oferecer descontos aos passageiros." />
      )}
      {tab === "general" && (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {coupons.map((c) => (
          <div key={c.id} className={`rounded-2xl border bg-card p-4 shadow-sm ${!c.active || isExpired(c) ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-mono font-bold text-primary">{c.code}</span>
              <div className="flex gap-1">
                <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copiado!"); }} className="rounded-lg p-1 hover:bg-muted">
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-lg p-1 hover:bg-muted" aria-label="Ações">
                      <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => useCouponForSend(c, "mass")}>
                      <Megaphone className="h-4 w-4 mr-2" /> Enviar em massa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useCouponForSend(c, "individual")}>
                      <UserPlus className="h-4 w-4 mr-2" /> Enviar individual
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copiado!"); }}>
                      <Copy className="h-4 w-4 mr-2" /> Copiar código
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggle(c.id, c.active)}>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> {c.active ? "Desativar" : "Ativar"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => remove(c.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <p className="text-sm font-bold">{c.discount_type === "percentage" ? `${c.discount_value}%` : `R$ ${c.discount_value}`} off</p>
            <p className="text-xs text-muted-foreground">{c.used_count}/{c.max_uses} usos • Min R$ {c.min_fare}</p>
            {c.expires_at && (
              <p className={`text-[10px] mt-1 ${isExpired(c) ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                {isExpired(c) ? "Expirado" : "Válido até"} {new Date(c.expires_at).toLocaleDateString("pt-BR")}
              </p>
            )}
            <button onClick={() => toggle(c.id, c.active)} className={`mt-2 rounded-full px-3 py-1 text-xs font-bold ${c.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {c.active ? "Ativo" : "Inativo"}
            </button>
          </div>
        ))}
      </div>
      )}

      {tab === "send" && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Coluna 1 — Formulário + lista de passageiros */}
          <div className="space-y-3">
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><Send className="h-4 w-4 text-primary" /> Configurar cupom</h3>
              <input value={sendForm.code} onChange={(e) => setSendForm({ ...sendForm, code: e.target.value })} placeholder="Código (ex: BEMVINDO10)" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none uppercase" />
              <div className="flex gap-2">
                {["percentage", "fixed"].map((t) => (
                  <button key={t} onClick={() => setSendForm({ ...sendForm, discount_type: t })} className={`rounded-lg px-3 py-2 text-xs font-medium ${sendForm.discount_type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {t === "percentage" ? "Porcentagem %" : "Valor fixo R$"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Valor</label>
                  <input value={sendForm.discount_value} onChange={(e) => setSendForm({ ...sendForm, discount_value: e.target.value })} placeholder={sendForm.discount_type === "percentage" ? "10" : "5.00"} type="number" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Tarifa mín</label>
                  <input value={sendForm.min_fare} onChange={(e) => setSendForm({ ...sendForm, min_fare: e.target.value })} placeholder="0" type="number" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Validade (opcional)</label>
                <input value={sendForm.expires_at} onChange={(e) => setSendForm({ ...sendForm, expires_at: e.target.value })} type="datetime-local" className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Mensagem (opcional)</label>
                <textarea value={sendForm.message} onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })} placeholder="Ex.: Aproveite seu desconto exclusivo!" rows={2} className="w-full rounded-lg bg-muted px-3 py-2 text-sm outline-none resize-none" />
              </div>
              <button onClick={sendCoupon} disabled={sending || selectedIds.size === 0} className="w-full rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar para {selectedIds.size} passageiro{selectedIds.size === 1 ? "" : "s"}
              </button>
            </div>

            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> Passageiros</h3>
                <div className="flex gap-1.5">
                  <button onClick={selectAllVisible} className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold">Massa (todos)</button>
                  <button onClick={clearSelection} className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold">Limpar</button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={pSearch} onChange={(e) => setPSearch(e.target.value)} placeholder="Buscar por nome, email, telefone…" className="w-full rounded-lg bg-muted pl-8 pr-3 py-2 text-sm outline-none" />
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border">
                {filteredPassengers.length === 0 && (
                  <p className="p-4 text-center text-xs text-muted-foreground">Nenhum passageiro</p>
                )}
                {filteredPassengers.map((p) => {
                  const checked = selectedIds.has(p.user_id);
                  return (
                    <label key={p.user_id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40">
                      <input type="checkbox" checked={checked} onChange={() => toggleSelect(p.user_id)} className="h-4 w-4 accent-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.email || p.phone || "—"}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coluna 2 — Cupons enviados */}
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Cupons enviados ({sent.length})</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={sentSearch} onChange={(e) => setSentSearch(e.target.value)} placeholder="Buscar por nome, email ou código…" className="w-full rounded-lg bg-muted pl-8 pr-3 py-2 text-sm outline-none" />
            </div>
            <div className="max-h-[36rem] overflow-y-auto divide-y divide-border rounded-lg border">
              {filteredSent.length === 0 && (
                <p className="p-6 text-center text-xs text-muted-foreground">Nenhum cupom enviado ainda</p>
              )}
              {filteredSent.map((r) => (
                <div key={r.id} className="px-3 py-2.5 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-primary">{r.code}</span>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${r.used_at ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {r.used_at ? "Usado" : "Disponível"}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{r._profile?.full_name || "Passageiro"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{r._profile?.email || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {r.discount_type === "percentage" ? `${r.discount_value}%` : `R$ ${r.discount_value}`} • mín R$ {r.min_fare}
                    {r.expires_at && ` • até ${new Date(r.expires_at).toLocaleDateString("pt-BR")}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Enviado {new Date(r.created_at).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminCoupons;
