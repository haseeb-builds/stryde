import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type AuthenticatedSupabase = {
  supabase: SupabaseClient;
  user: User;
};

/**
 * Authenticate an API request against Supabase and return a request-scoped client.
 * Configuration is resolved at request time so a missing deployment environment
 * cannot fail the Next.js build during module evaluation.
 */
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
