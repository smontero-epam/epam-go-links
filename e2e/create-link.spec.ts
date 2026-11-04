import { expect, test } from "@playwright/test";
import { createForm, linkRow, statusRegion, uniqueSlug } from "./helpers.ts";

test.describe("create a shortcut", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("creates a link, announces it, clears the form and lists it", async ({ page }, testInfo) => {
    const slug = uniqueSlug(testInfo);
    const url = `https://wiki.example.com/${slug}`;
    const form = createForm(page);

    await form.slug.fill(slug);
    await form.url.fill(url);
    await form.description.fill("Created by the e2e create flow");
    await form.submit.click();

    await expect(statusRegion(page)).toHaveText(`Created go/${slug}`);
    await expect(form.slug).toHaveValue("");
    await expect(form.url).toHaveValue("");
    await expect(form.description).toHaveValue("");
    await expect(form.slug).toBeFocused();

    const row = linkRow(page, slug);
    await expect(row).toBeVisible();
    await expect(row.getByRole("link", { name: `go/${slug}` })).toHaveAttribute("href", `/go/${slug}`);
    await expect(row.getByTitle(url)).toHaveText(url);
    await expect(row).toContainText("Created by the e2e create flow");
  });

  test("shows client-side errors on the fields and focuses the first one", async ({ page }) => {
    const form = createForm(page);
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") {
        posts.push(request.url());
      }
    });

    await form.slug.fill("Bad slug!");
    await form.url.fill("javascript:alert(1)");
    await form.submit.click();

    const slugError = "Use lowercase letters, numbers and single hyphens, like design-system.";
    const urlError = "Enter a full URL starting with http:// or https://.";

    await expect(form.slug).toBeFocused();
    await expect(form.slug).toHaveAttribute("aria-invalid", "true");
    await expect(form.url).toHaveAttribute("aria-invalid", "true");
    await expect(form.description).not.toHaveAttribute("aria-invalid");

    // The message is visible and is part of the input's accessible description,
    // which is only true if aria-describedby points at it.
    await expect(page.getByText(slugError)).toBeVisible();
    await expect(page.getByText(urlError)).toBeVisible();
    await expect(form.slug).toHaveAccessibleDescription(new RegExp(escapeRegExp(slugError)));
    await expect(form.url).toHaveAccessibleDescription(new RegExp(escapeRegExp(urlError)));

    expect(posts, "invalid input must not reach the server").toEqual([]);
  });

  test("maps a taken slug from the server to the Shortcut field", async ({ page }) => {
    const form = createForm(page);

    // Normalizes to the seed link "oncall", so only the server can reject it.
    await form.slug.fill("OnCall");
    await form.url.fill("https://wiki.example.com/another-oncall");
    await form.submit.click();

    const message = "This shortcut is already taken.";
    await expect(page.getByText(message)).toBeVisible();
    await expect(form.slug).toHaveAttribute("aria-invalid", "true");
    await expect(form.slug).toHaveAccessibleDescription(new RegExp(escapeRegExp(message)));
    await expect(form.slug).toBeFocused();
    await expect(form.url).not.toHaveAttribute("aria-invalid");
    await expect(form.slug).toHaveValue("OnCall");
    await expect(page.getByText(/^Created go\//)).toHaveCount(0);
  });

  test("the status live region is in the accessibility tree before anything is announced", async ({ page }) => {
    test.fail(
      true,
      "Known bug: web/src/styles.css has `.status:empty { display: none }`, which removes the " +
        "aria-live region from the accessibility tree until its first message, so screen readers " +
        "can miss the first announcement. Remove test.fail() once the region stays rendered (e.g. visually empty).",
    );

    await expect(createForm(page).slug).toBeVisible();
    // getByRole only matches elements exposed to assistive technology.
    await expect(statusRegion(page)).toHaveCount(1, { timeout: 2000 });
  });

  test("can be completed with the keyboard only", async ({ page }, testInfo) => {
    const slug = uniqueSlug(testInfo);
    const form = createForm(page);

    await page.keyboard.press("Tab");
    await expect(form.slug).toBeFocused();
    await page.keyboard.type(slug);

    await page.keyboard.press("Tab");
    await expect(form.url).toBeFocused();
    await page.keyboard.type(`https://wiki.example.com/${slug}`);

    await page.keyboard.press("Tab");
    await expect(form.description).toBeFocused();
    await page.keyboard.type("Created with the keyboard");

    await page.keyboard.press("Enter");

    await expect(statusRegion(page)).toHaveText(`Created go/${slug}`);
    await expect(form.slug).toBeFocused();
    await expect(form.slug).toHaveValue("");
    await expect(linkRow(page, slug)).toBeVisible();
  });

  test("shows a form error and keeps the input when the server can't be reached", async ({ page }, testInfo) => {
    await page.route("**/api/links**", (route) =>
      route.request().method() === "POST" ? route.abort("connectionrefused") : route.fallback(),
    );
    const slug = uniqueSlug(testInfo);
    const form = createForm(page);

    await form.slug.fill(slug);
    await form.url.fill("https://wiki.example.com/unreachable");
    await form.submit.click();

    await expect(page.getByRole("alert")).toHaveText(
      "Can't reach the server. Check your connection and try again.",
    );
    await expect(form.slug).toHaveValue(slug);
    await expect(form.url).toHaveValue("https://wiki.example.com/unreachable");
    await expect(form.submit).toHaveText("Create shortcut");
    await expect(form.submit).toHaveAttribute("aria-disabled", "false");
  });
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
