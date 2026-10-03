import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { REGISTERED_WORKER_TYPES } from "@/lib/autonomy-policy";

export const runtime = "nodejs";

// The user's autonomy policy, inspectable and configurable. Deliberately not
// a settings dashboard: the surface is one endpoint the UI calls inline. A
// missing row means "unconfigured" and the product behaves as before.
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { data } = await supabase
      .from("user_autonomy_policy")
      .select("allow_worker_delegation, allowed_worker_types, auto_execute_research, updated_at")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    return NextResponse.json({
      configured: Boolean(data),
      policy: data ?? {
        allow_worker_delegation: false,
        allowed_worker_types: [...REGISTERED_WORKER_TYPES],
        auto_execute_research: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.toLowerCase().includes("token") || message.toLowerCase().includes("authentication") ? 401 : 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    if (typeof record.allow_worker_delegation !== "boolean" || typeof record.auto_execute_research !== "boolean") {
      return NextResponse.json({ error: "allow_worker_delegation and auto_execute_research must be booleans" }, { status: 400 });
    }
    const workerTypes = Array.isArray(record.allowed_worker_types) ? record.allowed_worker_types : null;
    if (!workerTypes || workerTypes.some((type) => !(REGISTERED_WORKER_TYPES as readonly string[]).includes(type as string))) {
      return NextResponse.json(
        { error: `allowed_worker_types must be a subset of ${REGISTERED_WORKER_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
    // Delegation enabled with an empty type list would silently disable every
    // worker; that state is a misconfiguration, not a policy.
    if (record.allow_worker_delegation === true && workerTypes.length === 0) {
      return NextResponse.json({ error: "Enable at least one worker type when delegation is allowed" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_autonomy_policy")
      .upsert(
        {
          owner_user_id: user.id,
          allow_worker_delegation: record.allow_worker_delegation,
          allowed_worker_types: workerTypes as string[],
          auto_execute_research: record.auto_execute_research,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_user_id" },
      )
      .select("allow_worker_delegation, allowed_worker_types, auto_execute_research, updated_at")
      .single();
    if (error) return NextResponse.json({ error: "Unable to save autonomy policy" }, { status: 500 });
    return NextResponse.json({ configured: true, policy: data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.toLowerCase().includes("token") || message.toLowerCase().includes("authentication") ? 401 : 500 },
    );
  }
}
