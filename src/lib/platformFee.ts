/**
 * platformFee — Resolve a porcentagem de comissão da plataforma.
 *
 * Hierarquia:
 *   1. tariffs.fee_percent (override por categoria, se preenchido)
 *   2. platform_settings.global_fee_percent (taxa global)
 *   3. fallback hardcoded 15%
 *
 * Uso:
 *   const pct = await getFeePercent("economico");   // ex: 15
 *   const fee = round2(price * pct / 100);
 */
import { supabase } from "@/integrations/supabase/client";

export type VehicleCategory = "moto" | "economico" | "conforto";

const DEFAULT_FEE_PERCENT = 15;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Lê o percentual aplicável à categoria. Faz duas queries em paralelo.
 * Retorna sempre um número entre 0 e 100.
 */
export async function getFeePercent(category: VehicleCategory): Promise<number> {
  const [tariffRes, settingRes] = await Promise.all([
    supabase
      .from("tariffs")
      .select("fee_percent")
      .eq("category", category)
      .eq("region", "default")
      .maybeSingle(),
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "global_fee_percent")
      .maybeSingle(),
  ]);

  const override = (tariffRes.data as any)?.fee_percent;
  if (override !== null && override !== undefined && !isNaN(Number(override))) {
    return clampPct(Number(override));
  }

  const global = (settingRes.data as any)?.value;
  const globalNum = typeof global === "number" ? global : Number(global);
  if (!isNaN(globalNum)) return clampPct(globalNum);

  return DEFAULT_FEE_PERCENT;
}

/** Calcula o valor da taxa em R$ aplicando o percentual sobre o preço. */
export async function calcPlatformFee(price: number, category: VehicleCategory): Promise<number> {
  const pct = await getFeePercent(category);
  return round2((price * pct) / 100);
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));
