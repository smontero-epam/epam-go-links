export type RedirectNotice = { kind: "missing"; slug: string } | { kind: "invalid"; raw: string };

/** The server's /go/ redirect sends unknown or invalid shortcuts here with a query parameter. */
export function readRedirectNotice(search: string): RedirectNotice | undefined {
  const params = new URLSearchParams(search);
  const missing = params.get("missing");
  if (missing) {
    return { kind: "missing", slug: missing };
  }
  const invalid = params.get("invalid");
  if (invalid) {
    return { kind: "invalid", raw: invalid };
  }
  return undefined;
}

type RedirectBannerProps = {
  notice: RedirectNotice;
  onDismiss: () => void;
};

export function RedirectBanner({ notice, onDismiss }: RedirectBannerProps) {
  return (
    <div className={`banner banner-${notice.kind}`} role="status">
      <p>
        {notice.kind === "missing" ? (
          <>
            <strong>go/{notice.slug}</strong> doesn't exist yet. Create it?
          </>
        ) : (
          <>
            <strong>go/{notice.raw}</strong> isn't a valid shortcut name. Names use lowercase letters,
            numbers and single hyphens, like design-system.
          </>
        )}
      </p>
      <button type="button" className="button-small" onClick={onDismiss}>
        Dismiss<span className="visually-hidden"> message</span>
      </button>
    </div>
  );
}
