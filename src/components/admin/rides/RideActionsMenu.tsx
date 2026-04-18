import { MoreHorizontal, Eye, Map, Phone, AlertTriangle, XCircle, DollarSign, CreditCard, Star, MessageCircle, FileText } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface Props {
  ride: any;
  onView: () => void;
  onMap: () => void;
  onContact: () => void;
  onIssue: () => void;
  onCancel: () => void;
  onAdjustPrice: () => void;
  onPayment: () => void;
  onRatings: () => void;
  onAddNote: () => void;
}

const RideActionsMenu = ({
  ride, onView, onMap, onContact, onIssue, onCancel,
  onAdjustPrice, onPayment, onRatings, onAddNote,
}: Props) => {
  const canCancel = !["completed", "cancelled"].includes(ride.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-lg p-1.5 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        title="Ações"
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase">Visualizar</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" /> Detalhes da corrida
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMap}>
          <Map className="h-4 w-4 mr-2" /> Ver no mapa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRatings}>
          <Star className="h-4 w-4 mr-2" /> Ver avaliações
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase">Contato</DropdownMenuLabel>
        <DropdownMenuItem onClick={onContact}>
          <Phone className="h-4 w-4 mr-2" /> Contatar envolvidos
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase">Pagamento</DropdownMenuLabel>
        <DropdownMenuItem onClick={onPayment}>
          <CreditCard className="h-4 w-4 mr-2" /> Ver / atualizar pagamento
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAdjustPrice}>
          <DollarSign className="h-4 w-4 mr-2" /> Ajustar valor
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase">Suporte</DropdownMenuLabel>
        <DropdownMenuItem onClick={onIssue}>
          <AlertTriangle className="h-4 w-4 mr-2 text-warning" /> Marcar como problema
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddNote}>
          <FileText className="h-4 w-4 mr-2" /> Adicionar observação
        </DropdownMenuItem>

        {canCancel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCancel} className="text-destructive focus:text-destructive">
              <XCircle className="h-4 w-4 mr-2" /> Cancelar corrida
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RideActionsMenu;
