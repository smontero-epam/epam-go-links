import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createLinkSchema, slugSchema } from "../../shared/link.ts";
import { AppError } from "../errors.ts";
import { SlugTakenError, type LinkRepository } from "../repo/link-repository.ts";

const listQuerySchema = z.object({
  q: z.string({ error: "Must be text." }).trim().optional(),
});

const slugParamsSchema = z.object({ slug: slugSchema });

export const linkRoutes: FastifyPluginAsync<{ repo: LinkRepository }> = async (app, { repo }) => {
  app.get("/", async (request) => {
    const { q } = listQuerySchema.parse(request.query);
    return { items: await repo.list(q) };
  });

  app.get("/:slug", async (request) => {
    const { slug } = slugParamsSchema.parse(request.params);
    const link = await repo.get(slug);
    if (!link) {
      throw new AppError("LINK_NOT_FOUND", 404, `go/${slug} doesn't exist.`);
    }
    return link;
  });

  app.post("/", async (request, reply) => {
    const input = createLinkSchema.parse(request.body);
    try {
      const link = await repo.create(input);
      request.log.info({ event: "link_created", slug: link.slug }, "link_created");
      reply.code(201).header("location", `/api/links/${link.slug}`);
      return link;
    } catch (error) {
      if (error instanceof SlugTakenError) {
        throw new AppError("SLUG_TAKEN", 409, `go/${input.slug} already exists.`, [
          { field: "slug", message: "This shortcut is already taken." },
        ]);
      }
      throw error;
    }
  });
};
