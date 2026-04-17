/**
 * Validação de placa de veículo brasileira.
 * Aceita formatos antigo (ABC1234) e Mercosul (ABC1D23).
 */

export function validatePlate(plate: string): boolean {
  const cleaned = plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length !== 7) return false;

  // Antigo: 3 letras + 4 números (AAA9999)
  const oldFormat = /^[A-Z]{3}[0-9]{4}$/;
  // Mercosul: 3 letras + 1 número + 1 letra + 2 números (AAA9A99)
  const mercosulFormat = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

  return oldFormat.test(cleaned) || mercosulFormat.test(cleaned);
}

const BLOCKED_PLATES = new Set([
  "AAA0000", "AAA1111", "ABC1234", "XXX0000", "TEST123",
  "AAA1A11", "AAA0A00",
]);

export function isFakePlate(plate: string): { fake: boolean; reason?: string } {
  const cleaned = plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (BLOCKED_PLATES.has(cleaned)) return { fake: true, reason: "Use a placa real do veículo" };
  // Todos iguais
  if (/^([A-Z0-9])\1{6}$/.test(cleaned)) return { fake: true, reason: "Placa inválida" };
  return { fake: false };
}
