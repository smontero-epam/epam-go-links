import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Link } from "../shared/link.ts";
import { buildApp } from "../server/app.ts";
import type { ErrorBody } from "../server/errors.ts";
import { InMemoryLinkRepository } from "../server/repo/in-memory-link-repository.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let repo: InMemoryLinkRepository;
let app: FastifyInstance;

beforeEach(() => {
  repo = new InMemoryLinkRepository();
  app = buildApp({ repo, logger: false });
});

afterEach(async () => {
  await app.close();
});

function createLink(payload: unknown) {
  return app.inject({ method: "POST", url: "/api/links", payload: payload as object });
}

async function listSlugs(query = ""): Promise<string[]> {
  const response = await app.inject({ url: `/api/links${query}` });
  return response.json<{ items: Link[] }>().items.map((link) => link.slug);
}

describe("POST /api/links", () => {
  it("creates a link, returns 201 with Location, and lists it", async () => {
    const response = await createLink({
      slug: " Team-Wiki ",
      url: "https://wiki.example.com/team",
      description: "Team space",
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers.location).toBe("/api/links/team-wiki");
    expect(response.json<Link>()).toMatchObject({
      slug: "team-wiki",
      url: "https://wiki.example.com/team",
      description: "Team space",
      visits: 0,
    });
    expect(await listSlugs()).toEqual(["design-system", "oncall", "payroll", "team-wiki"]);
  });

  it("returns 409 SLUG_TAKEN for a duplicate slug, regardless of case", async () => {
    const response = await createLink({ slug: "OnCall", url: "https://other.example.com" });

    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorBody>().error.code).toBe("SLUG_TAKEN");
  });

  it("returns 400 VALIDATION_ERROR with details for slug and url", async () => {
    const response = await createLink({ slug: "Hello World!", url: "javascript:alert(1)" });

    expect(response.statusCode).toBe(400);
    const { error } = response.json<ErrorBody>();
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details?.map((detail) => detail.field)).toEqual(["slug", "url"]);
  });
});

describe("GET /api/links", () => {
  it("filters by slug, URL or description, case-insensitively", async () => {
    expect(await listSlugs("?q=PAY")).toEqual(["payroll"]);
    expect(await listSlugs("?q=wiki.example")).toEqual(["oncall"]);
    expect(await listSlugs("?q=component")).toEqual(["design-system"]);
    expect(await listSlugs("?q=nothing-matches")).toEqual([]);
  });

  it("returns 404 LINK_NOT_FOUND for an unknown slug", async () => {
    const response = await app.inject({ url: "/api/links/unknown" });

    expect(response.statusCode).toBe(404);
    expect(response.json<ErrorBody>().error.code).toBe("LINK_NOT_FOUND");
  });
});

describe("GET /go/:slug", () => {
  it("redirects with 302 and no-store, and counts the visit", async () => {
    const response = await app.inject({ url: "/go/oncall" });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("https://wiki.example.com/oncall");
    expect(response.headers["cache-control"]).toBe("no-store");

    const link = await repo.get("oncall");
    expect(link?.visits).toBe(1);
    expect(link?.lastVisitedAt).toEqual(expect.any(String));
  });

  it("redirects an unknown slug to the create flow", async () => {
    const response = await app.inject({ url: "/go/unknown" });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/?missing=unknown");
  });

  it("redirects an invalid slug to the naming-rules message", async () => {
    const response = await app.inject({ url: "/go/Hello%20World!" });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/?invalid=Hello%20World!");
  });
});

describe("request IDs and error format", () => {
  it("generates a UUID request ID when none is sent", async () => {
    const response = await app.inject({ url: "/health" });

    expect(response.headers["x-request-id"]).toMatch(UUID_PATTERN);
  });

  it("echoes a valid incoming x-request-id", async () => {
    const response = await app.inject({
      url: "/health",
      headers: { "x-request-id": "trace-abc-123" },
    });

    expect(response.headers["x-request-id"]).toBe("trace-abc-123");
  });

  it("replaces an invalid incoming x-request-id", async () => {
    const response = await app.inject({ url: "/health", headers: { "x-request-id": "bad id!" } });

    expect(response.headers["x-request-id"]).toMatch(UUID_PATTERN);
  });

  it("includes the request ID in error bodies", async () => {
    const response = await app.inject({ url: "/api/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.json<ErrorBody>()).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found." },
      requestId: response.headers["x-request-id"],
    });
  });

  it("hides internal error details from clients", async () => {
    repo.list = async () => {
      throw new Error("connection string with secrets");
    };

    const response = await app.inject({ url: "/api/links" });

    expect(response.statusCode).toBe(500);
    expect(response.json<ErrorBody>().error.code).toBe("INTERNAL_ERROR");
    expect(response.body).not.toContain("secrets");
  });
});
