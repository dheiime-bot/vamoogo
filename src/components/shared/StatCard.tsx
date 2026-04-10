import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "primary" | "warning" | "success";
}

const variantStyles = {
  default: "bg-card",
  primary: "bg-primary/5 border-primary/20",
  warning: "bg-warning/5 border-warning/20",
  success: "bg-success/5 border-success/20",
};

const iconVariant = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
};

const StatCard = ({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) => (
  <div className={cn("rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md", variantStyles[variant])}>
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {trend && (
          <p className={cn("text-xs font-medium", trend.positive ? "text-success" : "text-destructive")}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
      <div className={cn("rounded-xl p-2.5", iconVariant[variant])}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

export default StatCard;
