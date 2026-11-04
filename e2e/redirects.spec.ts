import { expect, test } from "@playwright/test";
import { createForm, statusRegion, uniqueSlug } from "./helpers.ts";

// Destinations are placeholder example.com hosts, so known links are checked
// at the HTTP level instead of being followed in the browser.
test.describe("go/ redirects over HTTP", () => {
  test("a known slug redirects with 302 to its URL and is not cacheable", async ({ request }) => {
    const response = await request.get("/go/oncall", { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe("https://wiki.example.com/oncall");
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("an unknown slug redirects to the create-it page", async ({ request }, testInfo) => {
    const slug = uniqueSlug(testInfo);
    const response = await request.get(`/go/${slug}`, { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe(`/?missing=${slug}`);
    expect(response.headers()["cache-control"]).toBe("no-store");
  });
});

test.describe("go/ redirects in the page", () => {
  test("a missing link shows a banner, pre-fills the form and can be created", async ({ page }, testInfo) => {
    const slug = uniqueSlug(testInfo);
    const form = createForm(page);

    await page.goto(`/go/${slug}`);

    const banner = page.getByRole("status").filter({ hasText: "doesn't exist yet" });
    await expect(banner).toHaveText(new RegExp(`^go/${slug} doesn't exist yet\\. Create it\\?`));
    await expect(form.slug).toHaveValue(slug);
    await expect(form.url).toBeFocused();
    // The query is dropped so reloading doesn't bring the banner back.
    await expect(page).toHaveURL("/");

    await page.keyboard.type(`https://wiki.example.com/${slug}`);
    await form.submit.click();

    await expect(statusRegion(page)).toHaveText(`Created go/${slug}`);
    await expect(banner).toBeHidden();
  });

  test("an invalid name explains the naming rules", async ({ page }) => {
    const form = createForm(page);

    await page.goto("/go/Bad%20Name");

    const banner = page.getByRole("status").filter({ hasText: "isn't a valid shortcut name" });
    await expect(banner).toContainText(
      "go/Bad Name isn't a valid shortcut name. Names use lowercase letters, numbers and single hyphens, like design-system.",
    );
    await expect(form.slug).toHaveValue("");
  });
});
