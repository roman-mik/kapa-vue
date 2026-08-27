import { parseSupabaseEnv, type SupabaseEnv } from "@/lib/env-schema";

export type { SupabaseEnv };

// Lazy (called, not evaluated at module scope) so importing this module — or
// modules that import it — never throws on its own; only calling this does.
export function supabaseEnv(): SupabaseEnv {
  return parseSupabaseEnv(import.meta.env as unknown as Record<string, string | undefined>);
}
