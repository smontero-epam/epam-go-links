import { z } from "zod";
import type { CreateLinkPayload, Link } from "../../shared/link.ts";

export type FieldErrors = Partial<Record<string, string>>;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors: FieldErrors = {},
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
  requestId: z.string().optional(),
});

/** First message per field, in the shape the form uses for client-side errors too. */
export function toFieldErrors(issues: readonly { field: string; message: string }[]): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const { field, message } of issues) {
    fieldErrors[field] ??= message;
  }
  return fieldErrors;
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = errorResponseSchema.safeParse(body);
  if (!parsed.success) {
    return new ApiError(
      "UNEXPECTED_RESPONSE",
      `The server sent an unexpected response (HTTP ${response.status}).`,
      {},
      requestId,
    );
  }
  const { error } = parsed.data;
  return new ApiError(
    error.code,
    error.message,
    toFieldErrors(error.details ?? []),
    parsed.data.requestId ?? requestId,
  );
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { accept: "application/json", ...init.headers },
    });
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new ApiError("NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

export async function listLinks(query: string, signal?: AbortSignal): Promise<Link[]> {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  const search = params.size > 0 ? `?${params}` : "";
  const { items } = await requestJson<{ items: Link[] }>(`/api/links${search}`, { signal });
  return items;
}

export function createLink(payload: CreateLinkPayload): Promise<Link> {
  return requestJson<Link>("/api/links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** A user-facing message; includes the request ID so support can find the logs. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  return error.requestId ? `${error.message} (Request ID: ${error.requestId})` : error.message;
}
