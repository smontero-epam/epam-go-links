import { createHash } from "node:crypto";
import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

// Different per worker process, so a reused dev server (whose in-memory data
// survives between runs) never sees the same slug twice.
const runId = `${process.pid}-${Date.now()}`;

function testHash(testInfo: TestInfo, salt: string): string {
  return createHash("sha256")
    .update(`${testInfo.testId}|${testInfo.retry}|${testInfo.repeatEachIndex}|${runId}|${salt}`)
    .digest("hex")
    .slice(0, 12);
}

function toSlugWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A slug unique to this test and run that matches the spec's rules
 * (`^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters). The title prefix only
 * helps when reading the list; the hash is what makes it unique.
 */
export function uniqueSlug(testInfo: TestInfo, suffix = ""): string {
  const title = toSlugWords(testInfo.title).slice(0, 24).replace(/-+$/, "");
  const parts = ["e2e", title, toSlugWords(suffix), testHash(testInfo, suffix)];
  return parts.filter(Boolean).join("-");
}

/** A word that appears in no seed link and no other test's data, for searching. */
export function uniqueWord(testInfo: TestInfo): string {
  return `zq${testHash(testInfo, "word")}`;
}

export async function createLinkViaApi(
  request: APIRequestContext,
  link: { slug: string; url: string; description?: string },
): Promise<void> {
  const response = await request.post("/api/links", { data: link });
  expect(response.status(), await response.text()).toBe(201);
}

/** The page-level aria-live region the app announces results in (not the redirect banner). */
export function statusRegion(page: Page) {
  return page.getByRole("status").and(page.locator('[aria-live="polite"]'));
}

export function createForm(page: Page) {
  return {
    slug: page.getByLabel("Shortcut", { exact: true }),
    url: page.getByLabel("Destination URL"),
    description: page.getByLabel("Description (optional)"),
    submit: page.getByRole("button", { name: "Create shortcut" }),
  };
}

export function linkRow(page: Page, slug: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: `go/${slug}`, exact: true }) });
}
