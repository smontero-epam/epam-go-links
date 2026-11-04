import { useCallback, useEffect, useState } from "react";
import type { Link } from "../../shared/link.ts";
import { CreateLinkForm } from "./components/CreateLinkForm.tsx";
import { LinkList } from "./components/LinkList.tsx";
import { readRedirectNotice, RedirectBanner } from "./components/RedirectBanner.tsx";
import { SearchBox } from "./components/SearchBox.tsx";
import { useDebouncedValue, useLinks } from "./hooks.ts";

const SEARCH_DEBOUNCE_MS = 200;

export function App() {
  const [notice, setNotice] = useState(() => readRedirectNotice(window.location.search));
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const { state, reload, retry } = useLinks(debouncedSearch);
  // The id re-renders the message so repeating the same text is announced again.
  const [status, setStatus] = useState({ id: 0, message: "" });

  const announce = useCallback((message: string) => {
    setStatus((previous) => ({ id: previous.id + 1, message }));
  }, []);

  // The notice lives in state now; drop the query so a reload doesn't show it again.
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  function handleCreated(link: Link) {
    announce(`Created go/${link.slug}`);
    if (notice?.kind === "missing" && notice.slug === link.slug) {
      setNotice(undefined);
    }
    reload();
  }

  return (
    <>
      <header className="page-header">
        <h1>go links</h1>
        <p>Short links to internal resources. Visit go/&lt;name&gt; in your browser.</p>
      </header>

      <main className="page">
        {notice && <RedirectBanner notice={notice} onDismiss={() => setNotice(undefined)} />}

        <section className="panel">
          <CreateLinkForm
            initialSlug={notice?.kind === "missing" ? notice.slug : undefined}
            onCreated={handleCreated}
          />
          <div className="status" role="status" aria-live="polite">
            {status.message && <p key={status.id}>{status.message}</p>}
          </div>
        </section>

        <section className="panel" aria-labelledby="links-heading">
          <h2 id="links-heading">Shortcuts</h2>
          <SearchBox value={search} onChange={setSearch} />
          <LinkList state={state} onRetry={retry} announce={announce} />
        </section>
      </main>
    </>
  );
}
