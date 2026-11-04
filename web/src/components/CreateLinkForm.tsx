import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { createLinkSchema, type Link } from "../../../shared/link.ts";
import { ApiError, createLink, describeError, toFieldErrors, type FieldErrors } from "../api.ts";
import { FormField } from "./FormField.tsx";

type FieldName = "slug" | "url" | "description";
type FormValues = Record<FieldName, string>;

const FIELD_ORDER: readonly FieldName[] = ["slug", "url", "description"];
const EMPTY_VALUES: FormValues = { slug: "", url: "", description: "" };

type CreateLinkFormProps = {
  /** Pre-filled when arriving from a go/ link that doesn't exist yet. */
  initialSlug?: string;
  onCreated: (link: Link) => void;
};

export function CreateLinkForm({ initialSlug = "", onCreated }: CreateLinkFormProps) {
  const [values, setValues] = useState<FormValues>({ ...EMPTY_VALUES, slug: initialSlug });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const slugRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const inputRefs = { slug: slugRef, url: urlRef, description: descriptionRef };

  useEffect(() => {
    if (initialSlug) {
      urlRef.current?.focus();
    }
  }, [initialSlug]);

  function updateField(name: FieldName, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setFieldErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  function showFieldErrors(errors: FieldErrors) {
    // Render the messages before moving focus, so screen readers announce
    // the field together with its error.
    flushSync(() => setFieldErrors(errors));
    const firstInvalid = FIELD_ORDER.find((name) => errors[name]);
    if (firstInvalid) {
      inputRefs[firstInvalid].current?.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setFormError(undefined);

    const parsed = createLinkSchema.safeParse(values);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        field: String(issue.path[0] ?? "form"),
        message: issue.message,
      }));
      showFieldErrors(toFieldErrors(issues));
      return;
    }

    setSaving(true);
    try {
      const link = await createLink(parsed.data);
      setValues(EMPTY_VALUES);
      setFieldErrors({});
      onCreated(link);
      slugRef.current?.focus();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        showFieldErrors(error.fieldErrors);
      } else {
        setFormError(describeError(error));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="create-form" onSubmit={handleSubmit} noValidate aria-labelledby="create-heading">
      <h2 id="create-heading">Create a shortcut</h2>

      <FormField
        id="slug"
        name="slug"
        label="Shortcut"
        prefix="go/"
        hint="People will visit go/ followed by this name. Use lowercase letters, numbers and hyphens, like design-system."
        error={fieldErrors.slug}
        inputRef={slugRef}
        value={values.slug}
        onChange={(event) => updateField("slug", event.target.value)}
        required
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
      />

      <FormField
        id="url"
        name="url"
        type="url"
        label="Destination URL"
        hint="The full address, starting with https://"
        error={fieldErrors.url}
        inputRef={urlRef}
        value={values.url}
        onChange={(event) => updateField("url", event.target.value)}
        required
        autoComplete="off"
        placeholder="https://"
      />

      <FormField
        id="description"
        name="description"
        label="Description (optional)"
        error={fieldErrors.description}
        inputRef={descriptionRef}
        value={values.description}
        onChange={(event) => updateField("description", event.target.value)}
        autoComplete="off"
      />

      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}

      {/* aria-disabled (not disabled) keeps keyboard focus on the button while saving. */}
      <button type="submit" className="button-primary" aria-disabled={saving}>
        {saving ? "Creating…" : "Create shortcut"}
      </button>
    </form>
  );
}
