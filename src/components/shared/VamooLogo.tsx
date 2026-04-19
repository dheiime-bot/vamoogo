/**
 * VamooLogo — logomarca oficial do Vamoo.
 * Renderiza a imagem da logo dentro de um cartão branco para garantir
 * contraste em fundos coloridos (gradiente do header).
 */
import logo from "@/assets/vamoo-logo.png";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Altura da logo em pixels. */
  height?: number;
  /** Mostra o cartão branco em volta. Útil sobre fundos coloridos. */
  card?: boolean;
}

const VamooLogo = ({ className, height = 56, card = true }: Props) => {
  const img = (
    <img
      src={logo}
      alt="Vamoo"
      style={{ height }}
      className="w-auto select-none object-contain"
      draggable={false}
    />
  );
  if (!card) return <div className={className}>{img}</div>;
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 shadow-md",
        className
      )}
    >
      {img}
    </div>
  );
};

export default VamooLogo;
