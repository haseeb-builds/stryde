import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment configuration");
}

export type AuthenticatedSupabase = {
  supabase: SupabaseClient<Database>;
  user: User;
};

export async function requireAuthenticatedSupabase(
  authorizationHeader: string | null,
): Promise<AuthenticatedSupabase> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const accessToken = authorizationHeader.slice("Bearer ".length).trim();
  if (!accessToken) {
    throw new Error("Missing bearer token");
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error("Invalid or expired authentication token");
  }

  return { supabase, user };
}

export function ownerId(user: User): string {
  return user.id;
}
