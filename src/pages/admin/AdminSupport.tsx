import { useEffect, useState } from "react";
import { MessageCircle, CheckCircle, Clock, AlertCircle } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminSupport = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [response, setResponse] = useState<Record<string, string>>({});

  const fetchTickets = async () => {
    const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (data) setTickets(data);
  };

  useEffect(() => { fetchTickets(); }, []);

  const respond = async (id: string) => {
    if (!response[id]) return;
    await supabase.from("support_tickets").update({ admin_response: response[id], status: "answered" }).eq("id", id);
    toast.success("Resposta enviada");
    setResponse((r) => ({ ...r, [id]: "" }));
    fetchTickets();
  };

  const close = async (id: string) => {
    await supabase.from("support_tickets").update({ status: "closed" }).eq("id", id);
    toast.success("Ticket fechado");
    fetchTickets();
  };

  const priorityStyle: Record<string, string> = {
    high: "bg-destructive/15 text-destructive",
    medium: "bg-warning/15 text-warning",
    low: "bg-muted text-muted-foreground",
  };

  return (
    <AdminLayout title="Suporte">
      {tickets.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">Nenhum ticket de suporte</p>}
      {tickets.map((t) => (
        <div key={t.id} className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-bold">{t.subject}</p>
              <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <div className="flex gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityStyle[t.priority] || priorityStyle.medium}`}>{t.priority}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${t.status === "open" ? "bg-info/15 text-info" : t.status === "answered" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {t.status === "open" ? "Aberto" : t.status === "answered" ? "Respondido" : "Fechado"}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{t.message}</p>
          {t.admin_response && (
            <div className="rounded-lg bg-success/5 border border-success/20 p-3 mb-3">
              <p className="text-xs font-semibold text-success mb-1">Resposta admin:</p>
              <p className="text-sm">{t.admin_response}</p>
            </div>
          )}
          {t.status !== "closed" && (
            <div className="flex gap-2">
              <input value={response[t.id] || ""} onChange={(e) => setResponse((r) => ({ ...r, [t.id]: e.target.value }))}
                placeholder="Responder..." className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm outline-none" />
              <button onClick={() => respond(t.id)} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Enviar</button>
              <button onClick={() => close(t.id)} className="rounded-lg border px-3 py-2 text-xs font-bold text-muted-foreground">Fechar</button>
            </div>
          )}
        </div>
      ))}
    </AdminLayout>
  );
};

export default AdminSupport;
