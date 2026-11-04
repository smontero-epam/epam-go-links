import { describe, expect, it } from "vitest";
import {
  createLinkSchema,
  descriptionSchema,
  normalizeSlug,
  RESERVED_SLUGS,
  slugSchema,
  urlSchema,
} from "../shared/link.ts";

function firstIssueMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("normalizeSlug", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeSlug("Design-System ")).toBe("design-system");
    expect(normalizeSlug("  ONCALL\t")).toBe("oncall");
  });
});

describe("slugSchema", () => {
  it.each(["a", "oncall", "design-system", "q3-okrs-2026", "a".repeat(64)])(
    "accepts %j",
    (slug) => {
      expect(slugSchema.parse(slug)).toBe(slug);
    },
  );

  it("normalizes before validating", () => {
    expect(slugSchema.parse("Design-System ")).toBe("design-system");
  });

  it.each(["hello world", "hello_world", "go/oncall", "café", "hello!", "a.b"])(
    "rejects invalid characters in %j",
    (slug) => {
      const result = slugSchema.safeParse(slug);
      expect(result.success).toBe(false);
      expect(firstIssueMessage(result)).toMatch(/lowercase letters, numbers and single hyphens/);
    },
  );

  it.each(["design--system", "-oncall", "oncall-", "-"])("rejects misplaced hyphens in %j", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });

  it.each(["", "   "])("rejects empty slug %j with a single message", (slug) => {
    const result = slugSchema.safeParse(slug);
    expect(result.error?.issues).toHaveLength(1);
    expect(firstIssueMessage(result)).toBe("Enter a shortcut name.");
  });

  it("rejects slugs longer than 64 characters", () => {
    const result = slugSchema.safeParse("a".repeat(65));
    expect(firstIssueMessage(result)).toBe("Use at most 64 characters.");
  });

  it.each(RESERVED_SLUGS)("rejects reserved word %j", (slug) => {
    const result = slugSchema.safeParse(slug);
    expect(result.success).toBe(false);
    expect(firstIssueMessage(result)).toMatch(/is reserved/);
  });

  it("rejects reserved words regardless of case", () => {
    expect(slugSchema.safeParse(" API ").success).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(firstIssueMessage(slugSchema.safeParse(42))).toBe("Must be text.");
    expect(firstIssueMessage(slugSchema.safeParse(undefined))).toBe("Enter a shortcut name.");
  });
});

describe("urlSchema", () => {
  it.each(["https://design.example.com", "http://wiki.example.com/oncall?tab=1#today"])(
    "accepts %j",
    (url) => {
      expect(urlSchema.parse(url)).toBe(url);
    },
  );

  it("trims whitespace", () => {
    expect(urlSchema.parse("  https://example.com  ")).toBe("https://example.com");
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://files.example.com",
    "/relative/path",
    "example.com",
    "https://",
  ])("rejects %j", (url) => {
    const result = urlSchema.safeParse(url);
    expect(result.success).toBe(false);
    expect(firstIssueMessage(result)).toMatch(/http:\/\/ or https:\/\//);
  });

  it("rejects an empty URL", () => {
    expect(firstIssueMessage(urlSchema.safeParse("  "))).toBe("Enter a destination URL.");
  });

  it("rejects URLs longer than 2048 characters", () => {
    const url = `https://example.com/${"a".repeat(2048)}`;
    expect(firstIssueMessage(urlSchema.safeParse(url))).toBe("Use at most 2048 characters.");
  });
});

describe("descriptionSchema", () => {
  it("trims the description", () => {
    expect(descriptionSchema.parse("  Payroll portal ")).toBe("Payroll portal");
  });

  it.each(["", "   ", undefined])("treats %j as absent", (description) => {
    expect(descriptionSchema.parse(description)).toBeUndefined();
  });

  it("accepts 200 characters and rejects 201", () => {
    expect(descriptionSchema.safeParse("a".repeat(200)).success).toBe(true);
    expect(firstIssueMessage(descriptionSchema.safeParse("a".repeat(201)))).toBe(
      "Use at most 200 characters.",
    );
  });
});

describe("createLinkSchema", () => {
  it("normalizes a valid payload", () => {
    const input = createLinkSchema.parse({
      slug: " Design-System",
      url: " https://design.example.com ",
      description: "",
    });
    expect(input).toEqual({ slug: "design-system", url: "https://design.example.com" });
  });

  it("reports an issue per invalid field, keyed by field name", () => {
    const result = createLinkSchema.safeParse({ slug: "Hello World!", url: "javascript:alert(1)" });
    const fields = result.error?.issues.map((issue) => issue.path.join("."));
    expect(fields).toEqual(["slug", "url"]);
  });

  it("reports missing required fields", () => {
    const result = createLinkSchema.safeParse({});
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Enter a shortcut name.",
      "Enter a destination URL.",
    ]);
  });

  it("rejects a non-object body", () => {
    expect(firstIssueMessage(createLinkSchema.safeParse(null))).toBe(
      "Send a JSON object with slug and url.",
    );
  });
});
