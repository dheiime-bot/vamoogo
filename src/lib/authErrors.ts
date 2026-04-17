/**
 * Traduz erros do Supabase Auth para mensagens claras em PT-BR.
 * Retorna { message, field } onde field indica em qual passo focar:
 *  - "password" → senha (vazada, fraca, curta)
 *  - "email"    → e-mail (já cadastrado, inválido)
 *  - "generic"  → outros
 */
export type AuthErrorField = "password" | "email" | "cpf" | "phone" | "plate" | "generic";

export interface FriendlyAuthError {
  message: string;
  field: AuthErrorField;
}

export const friendlyAuthError = (error: any): FriendlyAuthError => {
  const raw = (error?.message || "").toLowerCase();

  // Senha conhecida por ser fraca / fácil de adivinhar
  if (
    raw.includes("known to be weak") ||
    raw.includes("weak and easy to guess") ||
    raw.includes("easy to guess") ||
    raw.includes("choose a different password")
  ) {
    return {
      message: "Esta senha é fraca ou fácil de adivinhar. Escolha uma senha diferente, mais forte, com letras maiúsculas, minúsculas, números e símbolos.",
      field: "password",
    };
  }

  // Senha vazada (Have I Been Pwned)
  if (raw.includes("pwned") || raw.includes("compromised") || raw.includes("data breach") || raw.includes("leaked")) {
    return {
      message: "Esta senha já apareceu em vazamentos públicos e não é segura. Escolha uma senha diferente, com letras, números e símbolos.",
      field: "password",
    };
  }
  // Senha fraca / curta
  if (raw.includes("password") && (raw.includes("weak") || raw.includes("short") || raw.includes("at least") || raw.includes("characters"))) {
    return {
      message: "Senha muito fraca. Use no mínimo 8 caracteres com letras, números e símbolos.",
      field: "password",
    };
  }
  if (raw.includes("password")) {
    return {
      message: "Senha inválida. Tente outra com letras, números e símbolos.",
      field: "password",
    };
  }
  // E-mail
  if (raw.includes("already registered") || raw.includes("already exists") || raw.includes("user already")) {
    return { message: "Este e-mail já está cadastrado.", field: "email" };
  }
  if (raw.includes("invalid email") || raw.includes("email address") && raw.includes("invalid")) {
    return { message: "E-mail inválido.", field: "email" };
  }
  // Duplicidades (vindas de constraints do banco)
  if (raw.includes("duplicate") && raw.includes("cpf")) {
    return { message: "CPF já cadastrado.", field: "cpf" };
  }
  if (raw.includes("duplicate") && raw.includes("phone")) {
    return { message: "Telefone já cadastrado.", field: "phone" };
  }
  if (raw.includes("duplicate") && raw.includes("plate")) {
    return { message: "Placa já cadastrada.", field: "plate" };
  }
  // Rate limit
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return { message: "Muitas tentativas. Aguarde alguns segundos e tente novamente.", field: "generic" };
  }
  return {
    message: error?.message ? `Erro ao cadastrar: ${error.message}` : "Erro ao cadastrar. Tente novamente.",
    field: "generic",
  };
};
