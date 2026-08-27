import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export interface SupabaseEnv {
  url: string;
  key: string;
}

// Isomorphic (no import.meta.env access here) so vite.config.ts can import
// it directly to validate Vite's own loadEnv() result at build time, without
// dragging env.ts's browser-only `import.meta.env` read into the Node-side
// TS project (tsconfig.node.json has no DOM/vite-client types).
export function parseSupabaseEnv(raw: Record<string, string | undefined>): SupabaseEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid Supabase environment variables — ${message}`);
  }
  return { url: result.data.VITE_SUPABASE_URL, key: result.data.VITE_SUPABASE_PUBLISHABLE_KEY };
}
