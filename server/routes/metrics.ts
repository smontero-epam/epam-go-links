import type { FastifyPluginAsync } from "fastify";
import type { RedirectMetrics } from "../metrics.ts";
import type { LinkRepository } from "../repo/link-repository.ts";

export type MetricsResponse = {
  links: number;
  redirects: number;
  misses: number;
};

export const metricsRoutes: FastifyPluginAsync<{
  repo: LinkRepository;
  metrics: RedirectMetrics;
}> = async (app, { repo, metrics }) => {
  app.get("/api/metrics", async (): Promise<MetricsResponse> => {
    // Fine for in-memory data; a database implementation would use COUNT/SUM.
    const links = await repo.list();
    return {
      links: links.length,
      redirects: links.reduce((total, link) => total + link.visits, 0),
      misses: metrics.misses,
    };
  });
};
