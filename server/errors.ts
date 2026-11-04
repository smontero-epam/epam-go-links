import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "LINK_NOT_FOUND"
  | "SLUG_TAKEN"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export type FieldError = { field: string; message: string };

export type ErrorBody = {
  error: { code: ErrorCode; message: string; details?: FieldError[] };
  requestId: string;
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly statusCode: number,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = "AppError";
  }
}

function fromZodError(error: z.ZodError): AppError {
  const details = error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
  return new AppError("VALIDATION_ERROR", 400, "The request is invalid.", details);
}

// Fastify's own 4xx errors (malformed JSON, unsupported content type, body too
// large) carry messages written for clients, so they are safe to pass through.
function isFastifyClientError(error: unknown): error is FastifyError {
  if (!(error instanceof Error) || !("statusCode" in error)) {
    return false;
  }
  const { statusCode } = error;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500;
}

function toAppError(error: unknown): AppError | undefined {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof z.ZodError) {
    return fromZodError(error);
  }
  if (isFastifyClientError(error)) {
    return new AppError("VALIDATION_ERROR", error.statusCode ?? 400, error.message);
  }
  return undefined;
}

function sendError(reply: FastifyReply, requestId: string, error: AppError): FastifyReply {
  const body: ErrorBody = {
    error: { code: error.code, message: error.message, details: error.details },
    requestId,
  };
  return reply.code(error.statusCode).send(body);
}

export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  const appError = toAppError(error);
  if (appError) {
    return sendError(reply, request.id, appError);
  }
  // Full details stay in the logs; clients only get a generic message and the request ID.
  request.log.error({ err: error }, "unhandled error");
  return sendError(
    reply,
    request.id,
    new AppError("INTERNAL_ERROR", 500, "Something went wrong. Please try again."),
  );
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return sendError(reply, request.id, new AppError("NOT_FOUND", 404, "Route not found."));
}
