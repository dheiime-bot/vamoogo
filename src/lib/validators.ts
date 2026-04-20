/**
 * Validates a Brazilian CPF number using the official algorithm.
 * @param cpf - CPF string (with or without formatting)
 * @returns true if valid
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;

  // Reject known invalid patterns (all same digit)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;

  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;

  return true;
}

/**
 * Formats a CPF string as XXX.XXX.XXX-XX
 */
export function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

/**
 * Formats a phone number as (XX) XXXXX-XXXX
 */
export function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}

/**
 * Formats a license plate as ABC-1D23 or ABC-1234
 */
export function formatPlate(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

/**
 * Formats a RENAVAM (only digits, max 11)
 */
export function formatRenavam(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/**
 * Validates a RENAVAM. RENAVAM brasileiro tem 11 dígitos (antigo: 9).
 * Aceita 9-11 dígitos para compatibilidade com documentos antigos.
 */
export function validateRenavam(value: string): boolean {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length < 9 || cleaned.length > 11) return false;
  // rejeita todos iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;
  return true;
}
