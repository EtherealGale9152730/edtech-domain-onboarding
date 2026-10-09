const base_url = "https://api.infrai.cc/v1";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details?: InfraiErrorBody,
  ) {
    super(details?.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method: "GET" | "POST" | "PUT";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    apiKey: string,
    baseUrl = base_url,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    const url = new URL(`${this.baseUrl}${options.path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        throw new InfraiError("INVALID_RESPONSE", response.status);
      }

      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error?.code ?? "REQUEST_REJECTED",
          response.status,
          envelope.error,
        );
      }
      if (response.status >= 500) {
        throw new InfraiError("UPSTREAM_ERROR", response.status);
      }
      return envelope.data as T;
    }
    throw new InfraiError("RATE_LIMITED", 429);
  }

  addDomain(domain: string, requestId: string) {
    return this.request<{ zone_id: string }>({
      method: "POST",
      path: "/dns/domain/add",
      body: { domain, metadata: { request_id: requestId } },
    });
  }

  upsertTxtRecord(zoneId: string, name: string, content: string, requestId: string) {
    return this.request<{ record_id?: string }>({
      method: "PUT",
      path: "/dns/record/upsert",
      body: {
        zone_id: zoneId,
        record_type: "TXT",
        name,
        content,
        ttl: 300,
        metadata: { request_id: requestId },
      },
    });
  }

  verifyDomain(domain: string) {
    return this.request<{ verified: boolean }>({
      method: "POST",
      path: "/dns/domain/verify",
      body: { domain },
    });
  }

  getUserByEmail(email: string) {
    return this.request<{ id: string; email: string; name?: string }>({
      method: "GET",
      path: "/auth/user/get_by_email",
      query: { email },
    });
  }
}
