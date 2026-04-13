import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";

const AdminAudit = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setLogs(data); });
  }, []);

  return (
    <AdminLayout title="Auditoria">
      {logs.length === 0 && (
        <div className="text-center py-12">
          <ScrollText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum log de auditoria registrado</p>
          <p className="text-xs text-muted-foreground mt-1">Ações administrativas serão registradas aqui automaticamente</p>
        </div>
      )}
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="rounded-xl border bg-card p-4 flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2"><ScrollText className="h-4 w-4 text-muted-foreground" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{log.action}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{log.entity_type}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{new Date(log.created_at).toLocaleString("pt-BR")}</p>
              {log.entity_id && <p className="text-xs text-muted-foreground">ID: {log.entity_id}</p>}
              {log.details && Object.keys(log.details).length > 0 && (
                <pre className="text-xs text-muted-foreground mt-1 bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminAudit;
