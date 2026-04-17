import { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";

interface CanProps {
  module: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renderiza children apenas se o usuário tiver a permissão (module+action).
 * Use fallback para mostrar mensagem de acesso negado quando necessário.
 */
export const Can = ({ module, action, children, fallback = null }: CanProps) => {
  const { allowed, loading } = usePermission(module, action);
  if (loading) return null;
  return <>{allowed ? children : fallback}</>;
};
