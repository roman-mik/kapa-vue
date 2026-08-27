import type { Database } from "@roman-mik/kapa-core/types";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/env";

const { url, key } = supabaseEnv();

// SPA client (not @supabase/ssr — that's for cookie/SSR frameworks). The
// default browser client persists the session to localStorage, which is
// what lets a reload survive without re-authenticating.
export const supabase = createClient<Database>(url, key);
