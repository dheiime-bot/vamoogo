/**
 * Anti-fake data validation: blocks common test/placeholder data
 * to prevent fake accounts in production.
 */

const BLOCKED_NAMES = [
  "teste", "test", "fake", "fulano", "ciclano", "beltrano",
  "joao silva", "maria silva", "asdf", "qwerty", "abcdef",
  "user test", "usuario teste", "lorem ipsum", "admin admin",
  "nome sobrenome", "nome completo",
];

const BLOCKED_EMAIL_DOMAINS = [
  // Temporary / disposable
  "tempmail.com", "10minutemail.com", "mailinator.com", "guerrillamail.com",
  "throwaway.email", "yopmail.com", "trashmail.com", "fakeinbox.com",
  "maildrop.cc", "getnada.com", "temp-mail.org", "dispostable.com",
  // Obvious test
  "example.com", "test.com", "fake.com", "teste.com", "email.com",
];

const BLOCKED_CPFS = new Set([
  "11111111111", "22222222222", "33333333333", "44444444444",
  "55555555555", "66666666666", "77777777777", "88888888888",
  "99999999999", "00000000000", "12345678909", // CPFs públicos de teste
]);

const BLOCKED_PHONE_PATTERNS = [
  /^(\d)\1{10}$/,        // todos iguais
  /^(\d{2})1{9}$/,       // DDD + 9 uns
  /^11999999999$/,
  /^11111111111$/,
  /^00000000000$/,
  /^12345678901$/,
];

export function isFakeName(name: string): { fake: boolean; reason?: string } {
  const cleaned = name.trim().toLowerCase().replace(/\s+/g, " ");

  if (cleaned.length < 5) return { fake: true, reason: "Nome muito curto" };

  // Precisa ter ao menos 2 palavras (nome + sobrenome)
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2) return { fake: true, reason: "Informe nome e sobrenome" };

  // Cada parte com pelo menos 2 letras
  if (parts.some((p) => p.length < 2)) return { fake: true, reason: "Sobrenome muito curto" };

  // Apenas letras e espaços (acentos permitidos)
  if (!/^[a-záàâãäéèêëíïóôõöúùûüçñ\s'-]+$/i.test(cleaned)) {
    return { fake: true, reason: "Nome contém caracteres inválidos" };
  }

  // Bloquear nomes conhecidos
  if (BLOCKED_NAMES.some((b) => cleaned === b || cleaned.startsWith(b + " "))) {
    return { fake: true, reason: "Use seu nome real" };
  }

  // Bloquear sequências repetidas (aaaaa, abcabc)
  if (/(.)\1{4,}/.test(cleaned)) return { fake: true, reason: "Nome inválido" };

  return { fake: false };
}

export function isFakeEmail(email: string): { fake: boolean; reason?: string } {
  const cleaned = email.trim().toLowerCase();
  const domain = cleaned.split("@")[1];
  if (!domain) return { fake: true, reason: "E-mail inválido" };

  if (BLOCKED_EMAIL_DOMAINS.includes(domain)) {
    return { fake: true, reason: "Use um e-mail real (descartáveis não são aceitos)" };
  }

  // Local part muito repetitivo
  const local = cleaned.split("@")[0];
  if (/^(.)\1{4,}$/.test(local)) return { fake: true, reason: "E-mail inválido" };

  return { fake: false };
}

export function isFakeCPF(cpf: string): { fake: boolean; reason?: string } {
  const cleaned = cpf.replace(/\D/g, "");
  if (BLOCKED_CPFS.has(cleaned)) return { fake: true, reason: "Use seu CPF real" };
  return { fake: false };
}

export function isFakePhone(phone: string): { fake: boolean; reason?: string } {
  const cleaned = phone.replace(/\D/g, "");
  if (BLOCKED_PHONE_PATTERNS.some((re) => re.test(cleaned))) {
    return { fake: true, reason: "Use seu telefone real" };
  }
  return { fake: false };
}

/**
 * Verifica senha. Regra simples: pelo menos 8 caracteres, contendo letras e números.
 * Retorna `ok=true` quando a regra é atendida. `score` (0-4) é só visual.
 */
export function checkPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
  ok: boolean;
} {
  const hasMinLen = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const ok = hasMinLen && hasLetter && hasDigit;

  // Score apenas para barra visual (não impede o cadastro)
  let score = 0;
  if (hasMinLen) score++;
  if (hasLetter && hasDigit) score++;
  if (password.length >= 12) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ["Muito curta", "Curta", "OK", "Boa", "Forte"];
  const colors = ["bg-destructive", "bg-warning", "bg-success", "bg-success", "bg-success"];

  return {
    score,
    label: labels[Math.min(score, labels.length - 1)],
    color: colors[Math.min(score, colors.length - 1)],
    ok,
  };
}
