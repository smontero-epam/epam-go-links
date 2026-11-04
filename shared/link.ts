import { z } from "zod";

export type Link = {
  slug: string;
  url: string;
  description?: string;
  createdAt: string;
  visits: number;
  lastVisitedAt?: string;
};

export const SLUG_MAX_LENGTH = 64;
export const URL_MAX_LENGTH = 2048;
export const DESCRIPTION_MAX_LENGTH = 200;
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// These collide with the app's own routes and static files.
export const RESERVED_SLUGS: readonly string[] = ["api", "go", "health", "new", "assets"];

const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

// Only absolute web URLs: other schemes (javascript:, data:, ...) would enable
// stored XSS in the list or redirects to non-web handlers.
function isHttpUrl(value: string): boolean {
  const parsed = URL.parse(value);
  return parsed !== null && ALLOWED_URL_PROTOCOLS.has(parsed.protocol);
}

function requiredText(missingMessage: string) {
  return z.string({
    error: (issue) => (issue.input === undefined ? missingMessage : "Must be text."),
  });
}

export const slugSchema = requiredText("Enter a shortcut name.")
  .overwrite(normalizeSlug)
  .min(1, { error: "Enter a shortcut name.", abort: true })
  .max(SLUG_MAX_LENGTH, { error: `Use at most ${SLUG_MAX_LENGTH} characters.`, abort: true })
  .regex(SLUG_PATTERN, {
    error: "Use lowercase letters, numbers and single hyphens, like design-system.",
    abort: true,
  })
  .refine((slug) => !RESERVED_SLUGS.includes(slug), {
    error: (issue) => `"${String(issue.input)}" is reserved. Choose another name.`,
  });

export const urlSchema = requiredText("Enter a destination URL.")
  .trim()
  .min(1, { error: "Enter a destination URL.", abort: true })
  .max(URL_MAX_LENGTH, { error: `Use at most ${URL_MAX_LENGTH} characters.`, abort: true })
  .refine(isHttpUrl, { error: "Enter a full URL starting with http:// or https://." });

export const descriptionSchema = z
  .string({ error: "Must be text." })
  .trim()
  .max(DESCRIPTION_MAX_LENGTH, { error: `Use at most ${DESCRIPTION_MAX_LENGTH} characters.` })
  .transform((description) => (description === "" ? undefined : description))
  .optional();

export const createLinkSchema = z.object(
  {
    slug: slugSchema,
    url: urlSchema,
    description: descriptionSchema,
  },
  { error: "Send a JSON object with slug and url." },
);

/** What clients send (before trimming and normalization). */
export type CreateLinkPayload = z.input<typeof createLinkSchema>;
/** What the server stores (normalized, empty description removed). */
export type CreateLinkInput = z.output<typeof createLinkSchema>;
