import { cn } from "@/lib/utils";

type Status = "online" | "offline" | "pending" | "approved" | "rejected" | "blocked" | "active" | "completed" | "cancelled" | "suspicious";

const statusConfig: Record<Status, { label: string; className: string }> = {
  online: { label: "Online", className: "bg-success/15 text-success" },
  offline: { label: "Offline", className: "bg-muted text-muted-foreground" },
  pending: { label: "Pendente", className: "bg-warning/15 text-warning" },
  approved: { label: "Aprovado", className: "bg-success/15 text-success" },
  rejected: { label: "Rejeitado", className: "bg-destructive/15 text-destructive" },
  blocked: { label: "Bloqueado", className: "bg-destructive/15 text-destructive" },
  active: { label: "Ativa", className: "bg-info/15 text-info" },
  completed: { label: "Concluída", className: "bg-success/15 text-success" },
  cancelled: { label: "Cancelada", className: "bg-destructive/15 text-destructive" },
  suspicious: { label: "Suspeita", className: "bg-warning/15 text-warning" },
};

const StatusBadge = ({ status }: { status: Status }) => {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", config.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "online" || status === "approved" || status === "completed" ? "bg-success" : status === "pending" || status === "suspicious" ? "bg-warning" : status === "offline" ? "bg-muted-foreground" : "bg-destructive")} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
