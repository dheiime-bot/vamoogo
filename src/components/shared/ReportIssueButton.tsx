/**
 * ReportIssueButton — botão único para reportar problema vinculado a uma corrida.
 *
 * Regra de negócio:
 *  - Janela de 3h após o término (completed_at OU cancelled_at) para abrir chamado
 *    vinculado à corrida. Mostra botão amarelo "Reportar problema".
 *  - Após 3h, vira um selo verde "Corrida sem incidentes" não-clicável.
 *    O usuário só pode falar com a Central pelo chat geral depois disso.
 *  - Se a corrida ainda não terminou, mantém o botão amarelo.
 */
import { AlertCircle, ShieldCheck } from "lucide-react";
import { isWithinReportWindow } from "./ReportRideIssueModal";

interface Props {
  endedAt?: string | null; // completed_at ou cancelled_at
  onClick: () => void;
}

const ReportIssueButton = ({ endedAt, onClick }: Props) => {
  const canReport = isWithinReportWindow(endedAt);

  if (!canReport) {
    return (
      <span
        title="Prazo de 3 horas para reportar expirou. Fale com a Central pelo chat."
        className="flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-[11px] font-bold text-success cursor-default select-none"
      >
        <ShieldCheck className="h-3.5 w-3.5" /> Corrida sem incidentes
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg border border-warning/40 px-2.5 py-1.5 text-[11px] font-bold text-warning hover:bg-warning/10"
    >
      <AlertCircle className="h-3.5 w-3.5" /> Reportar problema
    </button>
  );
};

export default ReportIssueButton;
