/**
 * Traduz erros vindos das triggers de proteção (travas obrigatórias) em
 * mensagens amigáveis para os usuários. Usa o `message` do Postgres puro,
 * já que as triggers em pt-BR já vêm com texto adequado para exibir.
 *
 * Uso: toast.error(guardErrorMessage(error, "Não foi possível X"));
 */

type AnyErr = { message?: string; code?: string; details?: string } | null | undefined;

const TRIGGER_MARKERS = [
  "Cadastre seu telefone",
  "Sua conta está bloqueada",
  "Sua conta está suspensa",
  "Você já tem uma corrida em andamento",
  "Seu cadastro ainda não foi aprovado",
  "Cadastro não aprovado",
  "Você foi impedido de ficar online",
  "Você está impedido pelo admin",
  "Saldo insuficiente para aceitar",
  "Você já está em outra corrida",
  "Não é possível finalizar uma corrida que não foi iniciada",
  "Corrida já finalizada",
];

export function isGuardError(err: AnyErr): boolean {
  if (!err?.message) return false;
  return TRIGGER_MARKERS.some((m) => err.message!.includes(m));
}

export function guardErrorMessage(err: AnyErr, fallback: string): string {
  if (!err) return fallback;
  if (isGuardError(err)) return err.message!;
  return `${fallback}: ${err.message ?? "erro desconhecido"}`;
}
