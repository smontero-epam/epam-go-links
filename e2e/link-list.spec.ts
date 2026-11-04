import { expect, test } from "@playwright/test";
import { createLinkViaApi, linkRow, statusRegion, uniqueSlug, uniqueWord } from "./helpers.ts";

test.describe("shortcut list", () => {
  test("search matches by description, reports no results, and clearing restores the list", async ({
    page,
    request,
  }, testInfo) => {
    const word = uniqueWord(testInfo);
    const slug = uniqueSlug(testInfo);
    await createLinkViaApi(request, {
      slug,
      url: "https://wiki.example.com/search-target",
      description: `Search target ${word}`,
    });

    await page.goto("/");
    const search = page.getByLabel("Search shortcuts");
    const seedRow = linkRow(page, "oncall");
    await expect(seedRow).toBeVisible();

    await search.fill(word);
    await expect(linkRow(page, slug)).toBeVisible();
    await expect(seedRow).toBeHidden();
    // Exact because the word is unique to this test.
    await expect(page.getByText(`1 shortcut matching “${word}”`)).toBeVisible();

    await search.fill(`${word}-nothing`);
    await expect(page.getByText(`No shortcuts match “${word}-nothing”.`)).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();

    await search.fill("");
    await expect(seedRow).toBeVisible();
    await expect(linkRow(page, slug)).toBeVisible();
  });

  test.describe("copy", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("copies the full go/ URL and announces it", async ({ page, request, baseURL }, testInfo) => {
      const slug = uniqueSlug(testInfo);
      await createLinkViaApi(request, { slug, url: "https://wiki.example.com/copy-target" });
      const expectedUrl = `${baseURL}/go/${slug}`;

      await page.goto("/");
      await page.getByRole("button", { name: `Copy link to go/${slug}` }).click();

      await expect(statusRegion(page)).toHaveText(`Copied ${expectedUrl}`);
      await expect(page.getByRole("button", { name: `Copied link to go/${slug}` })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expectedUrl);
    });
  });

  test("shows a load error with a Retry button that recovers", async ({ page }) => {
    // Fail every list request until the error is on screen: React StrictMode
    // runs the loading effect twice in dev, so "fail only the first request"
    // could hit the request that gets aborted anyway.
    await page.route("**/api/links**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side." },
          requestId: "e2e-simulated-500",
        }),
      }),
    );

    await page.goto("/");
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Couldn't load shortcuts.");
    await expect(alert).toContainText("Request ID: e2e-simulated-500");
    await expect(page.getByRole("table")).toBeHidden();

    await page.unrouteAll();
    await alert.getByRole("button", { name: "Retry" }).click();

    await expect(alert).toBeHidden();
    await expect(linkRow(page, "oncall")).toBeVisible();
  });

  test("sorting by visits puts the most visited first", async ({ page, request }, testInfo) => {
    const word = uniqueWord(testInfo);
    // Named so slug order (a, b) is the opposite of visit order (b, a).
    const lessVisited = uniqueSlug(testInfo, "a");
    const moreVisited = uniqueSlug(testInfo, "b");
    for (const slug of [lessVisited, moreVisited]) {
      await createLinkViaApi(request, {
        slug,
        url: `https://wiki.example.com/${slug}`,
        description: `Sort target ${word}`,
      });
    }
    for (const slug of [moreVisited, moreVisited, lessVisited]) {
      const response = await request.get(`/go/${slug}`, { maxRedirects: 0 });
      expect(response.status()).toBe(302);
    }

    await page.goto("/");
    // Only this test's links match, so the order below is the whole result.
    await page.getByLabel("Search shortcuts").fill(word);
    const shortcuts = page.getByRole("rowheader");
    await expect(shortcuts).toHaveText([`go/${lessVisited}`, `go/${moreVisited}`]);

    const visitsHeader = page.getByRole("columnheader", { name: "Visits" });
    const shortcutHeader = page.getByRole("columnheader", { name: "Shortcut" });
    await expect(shortcutHeader).toHaveAttribute("aria-sort", "ascending");
    await expect(visitsHeader).not.toHaveAttribute("aria-sort");

    await visitsHeader.getByRole("button", { name: "Visits" }).click();

    await expect(shortcuts).toHaveText([`go/${moreVisited}`, `go/${lessVisited}`]);
    await expect(visitsHeader).toHaveAttribute("aria-sort", "descending");
    await expect(shortcutHeader).not.toHaveAttribute("aria-sort");
    await expect(statusRegion(page)).toHaveText("Sorted by visits, most visited first");
    await expect(linkRow(page, moreVisited).getByRole("cell").nth(2)).toHaveText(/^2/);
    await expect(linkRow(page, lessVisited).getByRole("cell").nth(2)).toHaveText(/^1/);
  });
});
