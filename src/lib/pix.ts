/**
 * Pix BR Code (EMV) builder — gera o payload "copia e cola" do Pix estático.
 * Padrão oficial do Banco Central (EMV-MPM).
 *
 * Útil para QR Codes Pix sem integração com gateway:
 * - O passageiro escaneia / copia e paga.
 * - O motorista confirma manualmente o recebimento.
 */

export type PixKeyType = "cpf" | "email" | "phone" | "random";

interface BuildPixPayloadInput {
  key: string;
  keyType: PixKeyType;
  amount: number;
  /** Nome do recebedor (motorista). Máx 25 chars. */
  merchantName: string;
  /** Cidade do recebedor. Máx 15 chars. */
  merchantCity?: string;
  /** Identificador da transação (ex: id da corrida). Máx 25 chars. */
  txid?: string;
  /** Descrição opcional. */
  description?: string;
}

const onlyAscii = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toUpperCase();

const sanitizeKey = (key: string, type: PixKeyType): string => {
  const trimmed = key.trim();
  switch (type) {
    case "cpf":
      return trimmed.replace(/\D/g, "");
    case "phone": {
      const digits = trimmed.replace(/\D/g, "");
      // Pix exige formato +55DDDNNNNNNNNN
      return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
    }
    case "email":
      return trimmed.toLowerCase();
    case "random":
    default:
      return trimmed;
  }
};

/** Codifica um campo TLV: ID(2) + LEN(2) + VALUE. */
const tlv = (id: string, value: string): string => {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
};

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) — padrão Pix. */
const crc16 = (payload: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

export function buildPixPayload(input: BuildPixPayloadInput): string {
  const key = sanitizeKey(input.key, input.keyType);
  const merchantName = onlyAscii(input.merchantName).slice(0, 25) || "RECEBEDOR";
  const merchantCity = onlyAscii(input.merchantCity || "BRASIL").slice(0, 15) || "BRASIL";
  const txid = (input.txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  // Merchant Account Information (ID 26) — Pix
  const gui = tlv("00", "br.gov.bcb.pix");
  const pixKey = tlv("01", key);
  const desc = input.description ? tlv("02", onlyAscii(input.description).slice(0, 60)) : "";
  const merchantAccount = tlv("26", `${gui}${pixKey}${desc}`);

  const additional = tlv("62", tlv("05", txid));

  const amountStr = input.amount > 0 ? input.amount.toFixed(2) : "";
  const amountField = amountStr ? tlv("54", amountStr) : "";

  const payloadWithoutCrc =
    tlv("00", "01") + // Payload Format Indicator
    tlv("01", "12") + // Point of Initiation Method (12 = QR dinâmico-like, mas aceito p/ estático com valor)
    merchantAccount +
    tlv("52", "0000") + // Merchant Category Code
    tlv("53", "986") + // Currency BRL
    amountField +
    tlv("58", "BR") + // Country
    tlv("59", merchantName) +
    tlv("60", merchantCity) +
    additional +
    "6304"; // CRC tag + length

  const crc = crc16(payloadWithoutCrc);
  return payloadWithoutCrc + crc;
}

export const pixKeyTypeLabel: Record<PixKeyType, string> = {
  cpf: "CPF",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave aleatória",
};
