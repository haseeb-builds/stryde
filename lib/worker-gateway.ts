export const WORKER_TYPES = ["HERMES", "OPENCODE"] as const;
export type WorkerType = (typeof WORKER_TYPES)[number];

export type WorkerWork = {
  pursuitId: string;
  actionId: string;
  workerType: WorkerType;
  instruction: string;
  context: unknown;
  idempotencyKey: string;
};

export type WorkerSubmission = {
  provider: WorkerType;
  externalWorkId: string;
};

export type WorkerResult = {
  provider: WorkerType;
  externalWorkId: string;
  status: "SUCCEEDED" | "FAILED" | "UNKNOWN";
  result: unknown;
  rawResultReference?: string | null;
};

export interface WorkerProvider {
  submit(work: WorkerWork): Promise<WorkerSubmission>;
  status(externalWorkId: string): Promise<"RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN">;
  cancel(externalWorkId: string): Promise<void>;
  result(externalWorkId: string): Promise<WorkerResult>;
}

class HttpWorkerProvider implements WorkerProvider {
  constructor(
    private readonly workerType: WorkerType,
    private readonly baseUrl: string,
    private readonly token: string | null,
  ) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async submit(work: WorkerWork): Promise<WorkerSubmission> {
    const response = await fetch(`${this.baseUrl}/work`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(work),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${this.workerType} worker submission failed (${response.status})`);
    const body = (await response.json()) as { external_work_id?: unknown };
    if (typeof body.external_work_id !== "string" || !body.external_work_id.trim()) {
      throw new Error(`${this.workerType} worker returned no external work id`);
    }
    return { provider: this.workerType, externalWorkId: body.external_work_id };
  }

  async status(externalWorkId: string) {
    const response = await fetch(`${this.baseUrl}/work/${encodeURIComponent(externalWorkId)}`, {
      headers: this.headers(),
      cache: "no-store",
    });
    if (!response.ok) return "UNKNOWN" as const;
    const body = (await response.json()) as { status?: unknown };
    if (body.status === "RUNNING" || body.status === "SUCCEEDED" || body.status === "FAILED") return body.status;
    return "UNKNOWN" as const;
  }

  async cancel(externalWorkId: string) {
    const response = await fetch(`${this.baseUrl}/work/${encodeURIComponent(externalWorkId)}`, {
      method: "DELETE",
      headers: this.headers(),
      cache: "no-store",
    });
    if (!response.ok && response.status !== 404) throw new Error(`${this.workerType} worker cancellation failed (${response.status})`);
  }

  async result(externalWorkId: string): Promise<WorkerResult> {
    const response = await fetch(`${this.baseUrl}/work/${encodeURIComponent(externalWorkId)}/result`, {
      headers: this.headers(),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${this.workerType} worker result fetch failed (${response.status})`);
    const body = (await response.json()) as { status?: unknown; result?: unknown; raw_result_reference?: unknown };
    const status = body.status === "SUCCEEDED" || body.status === "FAILED" || body.status === "UNKNOWN" ? body.status : "UNKNOWN";
    return {
      provider: this.workerType,
      externalWorkId,
      status,
      result: body.result ?? null,
      rawResultReference: typeof body.raw_result_reference === "string" ? body.raw_result_reference : null,
    };
  }
}

export function getWorkerProvider(type: WorkerType, env: NodeJS.ProcessEnv = process.env): WorkerProvider {
  const prefix = type === "HERMES" ? "STRYDE_HERMES" : "STRYDE_OPENCODE";
  const baseUrl = env[`${prefix}_URL`]?.trim();
  if (!baseUrl) throw new Error(`Worker provider ${type} is not configured`);
  const token = env[`${prefix}_TOKEN`]?.trim() || null;
  return new HttpWorkerProvider(type, baseUrl.replace(/\/$/, ""), token);
}
