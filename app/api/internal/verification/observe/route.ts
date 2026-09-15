import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { requireWorkerSecret } from "@/lib/internal-worker-auth";

export const runtime = "nodejs";

type ObservationRequest = {
  attempt_id: string;
  claim_id?: string | null;
  relation_type?: "SUPPORTS" | "CONTRADICTS" | "VERIFIES" | null;
};

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request);
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }
    const input = body as Partial<ObservationRequest>;
    if (typeof input.attempt_id !== "string" || input.attempt_id.trim() === "") {
      return NextResponse.json({ error: "attempt_id is required" }, { status: 400 });
    }
    if (input.claim_id && !input.relation_type) {
      return NextResponse.json({ error: "relation_type is required when claim_id is supplied" }, { status: 400 });
    }

    const { data, error } = await getSupabaseServiceClient().rpc("stryde_record_attempt_observation", {
      p_attempt_id: input.attempt_id.trim(),
      p_claim_id: input.claim_id ?? null,
      p_relation_type: input.relation_type ?? null,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ verification: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Observation recording failed";
    return NextResponse.json(
      { error: message },
      { status: message.toLowerCase().includes("authentication") ? 401 : 500 },
    );
  }
}
