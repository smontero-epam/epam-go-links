import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { errorHandler, notFoundHandler } from "./errors.ts";
import type { LinkRepository } from "./repo/link-repository.ts";
import { healthRoutes } from "./routes/health.ts";
import { linkRoutes } from "./routes/links.ts";
import { redirectRoutes } from "./routes/redirect.ts";

export type AppDeps = {
  repo: LinkRepository;
  logger?: FastifyServerOptions["logger"];
};

const REQUEST_ID_HEADER = "x-request-id";
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

// Reuse the caller's ID (e.g. from a proxy) so logs can be correlated across
// services, but only if it is safe to log and echo back.
function requestIdFor(request: IncomingMessage): string {
  const incoming = request.headers[REQUEST_ID_HEADER];
  return typeof incoming === "string" && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

export function buildApp({ repo, logger = true }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger,
    genReqId: requestIdFor,
    requestIdLogLabel: "requestId",
    // Replaced by the single summary line in onResponse below.
    disableRequestLogging: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime * 10) / 10,
      },
      "request completed",
    );
  });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.register(healthRoutes);
  app.register(linkRoutes, { prefix: "/api/links", repo });
  app.register(redirectRoutes, { repo });

  return app;
}
