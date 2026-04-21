/**
 * Cores e rótulos canônicos das categorias de veículo do Vamoo.
 * Use SEMPRE este arquivo para que todos os apps (passageiro, motorista, admin)
 * exibam as mesmas cores nos ícones de moto / carrinho.
 *
 * Paleta:
 *  - moto       → vermelho  (#dc2626)
 *  - economico  → amarelo da marca (#facc15)
 *  - conforto   → preto    (#0f172a)
 */

export type VehicleCategory = "moto" | "economico" | "conforto";

export const CATEGORY_COLOR: Record<VehicleCategory, string> = {
  moto: "#dc2626",
  economico: "#facc15",
  conforto: "#0f172a",
};

/** Cor do conteúdo (texto/ícone) ideal sobre a cor de fundo da categoria. */
export const CATEGORY_CONTENT_COLOR: Record<VehicleCategory, string> = {
  moto: "#ffffff",
  economico: "#0f172a",
  conforto: "#ffffff",
};

export const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  moto: "Moto",
  economico: "Econômico",
  conforto: "Conforto",
};

export const getCategoryColor = (cat?: string | null): string => {
  if (!cat) return CATEGORY_COLOR.economico;
  return CATEGORY_COLOR[cat as VehicleCategory] || CATEGORY_COLOR.economico;
};

export const getCategoryContentColor = (cat?: string | null): string => {
  if (!cat) return CATEGORY_CONTENT_COLOR.economico;
  return (
    CATEGORY_CONTENT_COLOR[cat as VehicleCategory] ||
    CATEGORY_CONTENT_COLOR.economico
  );
};

export const getCategoryLabel = (cat?: string | null): string => {
  if (!cat) return "—";
  return CATEGORY_LABEL[cat as VehicleCategory] || "—";
};