-- Forçar logout global: revogar todas as sessões e refresh tokens ativos
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.sessions;