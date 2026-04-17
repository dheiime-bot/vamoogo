import { CheckCircle2, Clock, FileWarning, XCircle, Hourglass } from "lucide-react";

export type DriverStatusKey =
  | "cadastro_enviado"
  | "em_analise"
  | "aprovado"
  | "approved" // legado
  | "reprovado"
  | "rejected" // legado
  | "pendente_documentos"
  | "pending" // legado (mapeia p/ em_analise)
  | "blocked";

export const driverStatusInfo: Record<string, {
  label: string;
  description: string;
  color: string;
  bg: string;
  icon: typeof Clock;
  canDrive: boolean;
}> = {
  cadastro_enviado: {
    label: "Cadastro enviado",
    description: "Recebemos seu cadastro. Em breve iniciaremos a análise.",
    color: "text-info",
    bg: "bg-info/10 border-info/30",
    icon: Hourglass,
    canDrive: false,
  },
  em_analise: {
    label: "Em análise",
    description: "Nosso time está analisando seus documentos. Isso pode levar até 24h.",
    color: "text-warning",
    bg: "bg-warning/10 border-warning/30",
    icon: Clock,
    canDrive: false,
  },
  pending: {
    label: "Em análise",
    description: "Nosso time está analisando seus documentos. Isso pode levar até 24h.",
    color: "text-warning",
    bg: "bg-warning/10 border-warning/30",
    icon: Clock,
    canDrive: false,
  },
  pendente_documentos: {
    label: "Pendente de documentos",
    description: "Precisamos que você reenvie alguns documentos. Veja a mensagem da equipe abaixo.",
    color: "text-warning",
    bg: "bg-warning/10 border-warning/30",
    icon: FileWarning,
    canDrive: false,
  },
  aprovado: {
    label: "Aprovado",
    description: "Tudo certo! Você já pode receber corridas.",
    color: "text-success",
    bg: "bg-success/10 border-success/30",
    icon: CheckCircle2,
    canDrive: true,
  },
  approved: {
    label: "Aprovado",
    description: "Tudo certo! Você já pode receber corridas.",
    color: "text-success",
    bg: "bg-success/10 border-success/30",
    icon: CheckCircle2,
    canDrive: true,
  },
  reprovado: {
    label: "Reprovado",
    description: "Seu cadastro foi reprovado. Veja o motivo abaixo e entre em contato com o suporte.",
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/30",
    icon: XCircle,
    canDrive: false,
  },
  rejected: {
    label: "Reprovado",
    description: "Seu cadastro foi reprovado. Veja o motivo abaixo e entre em contato com o suporte.",
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/30",
    icon: XCircle,
    canDrive: false,
  },
  blocked: {
    label: "Bloqueado",
    description: "Sua conta foi bloqueada. Entre em contato com o suporte.",
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/30",
    icon: XCircle,
    canDrive: false,
  },
};

export const getDriverStatusInfo = (status?: string | null) => {
  if (!status) return driverStatusInfo.cadastro_enviado;
  return driverStatusInfo[status] || driverStatusInfo.cadastro_enviado;
};
