import { useEffect, useState } from "react";
import { Shield, Eye, AlertTriangle, CheckCircle, Ban } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminFraud = () => {
  const [alerts, setAlerts] = useState<any[]>([]);

  const fetchAlerts = async () => {
    const { data } = await supabase.from("fraud_alerts").select("*").order("created_at", { ascending: false }).limit(30);
    if (data) setAlerts(data);
  };

  useEffect(() => { fetchAlerts(); }, []);

  const resolve = async (id: string, action: string) => {
    await supabase.from("fraud_alerts").update({ resolved: true, action_taken: action }).eq("id", id);
    toast.success(`Alerta resolvido: ${action}`);
    fetchAlerts();
  };

  const severityStyle: Record<string, string> = {
    probable: "bg-destructive/15 text-destructive",
    moderate: "bg-warning/15 text-warning",
    light: "bg-muted text-muted-foreground",
  };

  const severityLabel: Record<string, string> = {
    probable: "Fraude provável",
    moderate: "Suspeita moderada",
    light: "Suspeita leve",
  };

  return (
    <AdminLayout title="Sistema Antifraude" actions={
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">Monitoramento ativo</span>
      </div>
    }>
      <div className="flex items-center gap-3 rounded-xl bg-warning/10 border border-warning/30 p-4">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
        <p className="text-sm">
          <span className="font-semibold text-warning">{alerts.filter((a) => !a.resolved).length} alertas</span> pendentes.
          GPS monitorado 30 min pós-cancelamento.
        </p>
      </div>

      {alerts.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">Nenhum alerta de fraude</p>}

      {alerts.map((alert, i) => (
        <div key={alert.id} className={`rounded-2xl border bg-card p-5 shadow-sm animate-slide-up ${alert.resolved ? "opacity-60" : ""}`}
          style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-bold">Motorista {alert.driver_id?.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${severityStyle[alert.severity] || severityStyle.light}`}>
              {severityLabel[alert.severity] || alert.severity}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{alert.description}</p>
          {(alert.route_similarity || alert.time_match_minutes) && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground mb-4">
              {alert.route_similarity && `Rota ${(alert.route_similarity * 100).toFixed(0)}% similar`}
              {alert.time_match_minutes && ` • Tempo compatível: ${alert.time_match_minutes}min`}
            </div>
          )}
          {!alert.resolved ? (
            <div className="flex gap-2">
              <button onClick={() => resolve(alert.id, "investigado")} className="flex-1 rounded-lg border py-2 text-xs font-semibold hover:bg-muted">
                <Eye className="mr-1 inline h-3.5 w-3.5" /> Investigar
              </button>
              <button onClick={() => resolve(alert.id, "penalizado")} className="rounded-lg bg-warning/10 px-4 py-2 text-xs font-semibold text-warning">Penalizar</button>
              <button onClick={() => resolve(alert.id, "bloqueado")} className="rounded-lg bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive">Bloquear</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-success">
              <CheckCircle className="h-3.5 w-3.5" /> Resolvido: {alert.action_taken}
            </div>
          )}
        </div>
      ))}
    </AdminLayout>
  );
};

export default AdminFraud;
