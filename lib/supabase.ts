import { createClient } from "@supabase/supabase-js";
// Add this line to your existing supabase.ts
export const isSupabaseConfigured = true

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
