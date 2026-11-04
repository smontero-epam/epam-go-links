import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { slugSchema } from "../../shared/link.ts";
import type { RedirectMetrics } from "../metrics.ts";
import type { LinkRepository } from "../repo/link-repository.ts";

type GoRequest = FastifyRequest<{ Params: { "*"?: string } }>;

// 302 rather than 301: browsers cache 301s permanently, so a link's target
// could never change. no-store also keeps misses from sticking once created.
function redirect(reply: FastifyReply, location: string): FastifyReply {
  return reply.header("cache-control", "no-store").redirect(location, 302);
}

export const redirectRoutes: FastifyPluginAsync<{
  repo: LinkRepository;
  metrics: RedirectMetrics;
}> = async (app, { repo, metrics }) => {
  // A wildcard (not /go/:slug) so nested paths and over-long values reach this
  // handler and get the friendly "invalid" redirect instead of a JSON error.
  async function handleGo(request: GoRequest, reply: FastifyReply) {
    const raw = request.params["*"] ?? "";
    if (raw.trim() === "") {
      return redirect(reply, "/");
    }

    const parsed = slugSchema.safeParse(raw);
    if (!parsed.success) {
      return redirect(reply, `/?invalid=${encodeURIComponent(raw)}`);
    }

    const slug = parsed.data;
    const link = await repo.recordVisit(slug);
    if (!link) {
      metrics.recordMiss();
      request.log.info({ event: "link_miss", slug }, "link_miss");
      return redirect(reply, `/?missing=${encodeURIComponent(slug)}`);
    }

    request.log.info({ event: "link_redirect", slug, visits: link.visits }, "link_redirect");
    return redirect(reply, link.url);
  }

  app.get("/go", handleGo);
  app.get("/go/*", handleGo);
};
