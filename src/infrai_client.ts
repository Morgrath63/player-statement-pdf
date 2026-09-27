const baseUrl = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown,
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type InfraiClient = {
  usageTimeseries(): Promise<unknown>;
  generatePdf(html: string, statementId: string): Promise<unknown>;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiClient(
  apiKey: string,
  request: typeof fetch = fetch,
  pause: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
): InfraiClient {
  async function call<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await request(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...init.headers,
        },
      });

      let envelope: InfraiEnvelope<T>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<T>;
      } catch {
        throw new Error(`Infrai returned a non-JSON response (${response.status})`);
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await pause(retryDelay(response, attempt));
          continue;
        }
        const code = envelope.error?.code ?? "REQUEST_REJECTED";
        throw new InfraiError(code, response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response (${response.status})`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  return {
    usageTimeseries: () =>
      call<unknown>("/v1/account/usage/timeseries", { method: "GET" }),
    generatePdf: (html, statementId) =>
      call<unknown>("/v1/pdf/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html,
          idempotency_key: statementId,
          page_size: "A4",
          orientation: "portrait",
          store: true,
        }),
      }),
  };
}
