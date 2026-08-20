"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SOURCE_LABELS,
  kastenDocsSearchUrl,
  loadIndex,
  looksLikeProductQuestion,
  search,
  type Hit,
} from "../../lib/reference-search";
import { Chip } from "../ui/panel";
import { ExternalLinkIcon } from "../ui/icon";

// Ask-the-documents drawer.
//
// Framed as search, not as chat, because that is what it is — and the framing is
// load-bearing. A chat bubble implies an assistant that reasons and might be
// wrong in ways you cannot see; a result list implies passages you can read and
// judge. Since every word shown is lifted verbatim from a document, the honest
// presentation is the one where the reader can see that.
//
// Everything happens in the browser. Nothing about the question leaves the page.

const SUGGESTIONS = [
  "What RPO should production have?",
  "When is a backup application-consistent?",
  "What is Kasten DR and why does it matter?",
  "How often should we test restores?",
  "What does Level 4 look like for immutability?",
  "Cold, warm or export-only standby?",
];

const SOURCE_TONE = {
  playbook: "brand",
  workbook: "neutral",
  roadmap: "warn",
} as const;

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  // Longest first so "immutability" wins over "immutable" when both matched.
  const pattern = terms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        terms.some(t => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-brand-100 text-brand-900 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Result({ hit }: { hit: Hit }) {
  const { chunk } = hit;
  return (
    <li className="border-b border-line last:border-b-0 py-3.5">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <Chip tone={SOURCE_TONE[chunk.source]}>{SOURCE_LABELS[chunk.source]}</Chip>
        <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
          {chunk.source === "playbook" && chunk.section ? `Section ${chunk.section}` : chunk.section}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-ink leading-snug mb-1">{chunk.title}</h3>
      <p className="text-xs text-ink-soft leading-relaxed">
        <Highlight text={hit.snippet} terms={hit.matched} />
      </p>
      <a
        href={chunk.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-700 hover:underline mt-1.5"
      >
        Open {SOURCE_LABELS[chunk.source]}
        {chunk.page ? `, page ${chunk.page}` : ""} <ExternalLinkIcon />
      </a>
    </li>
  );
}

export function ReferenceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetched on first open, not at page load: 89 KB of index has no business in
  // the critical path of a checklist most users never ask a question about.
  useEffect(() => {
    if (!open) return;
    loadIndex()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message));
    inputRef.current?.focus();
  }, [open]);

  // Escape closes, matching every other drawer a user has met.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hits = useMemo(() => (ready && query.trim() ? search(query) : []), [ready, query]);
  const productish = query.trim().length > 3 && looksLikeProductQuestion(query);
  const run = useCallback((q: string) => setQuery(q), []);

  if (!open) return null;

  return (
    <>
      {/* Scrim. Click-to-close, and it dims the checklist enough to signal modality
          without hiding the context the question is probably about. */}
      <div
        className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ask the reference documents"
        className="fixed right-0 top-0 bottom-0 z-40 w-full sm:w-[30rem] bg-surface border-l border-line shadow-raised flex flex-col"
      >
        <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Ask the reference documents</h2>
            <p className="text-2xs text-ink-muted mt-0.5">
              Searches the Playbook, the workbook and the 100-day roadmap. Runs entirely in your browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink text-xl leading-none px-1 shrink-0"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-3 border-b border-line">
          <label htmlFor="reference-query" className="sr-only">
            Search the reference documents
          </label>
          <input
            ref={inputRef}
            id="reference-query"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. how often should we test restores?"
            suppressHydrationWarning
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {error && (
            <p className="text-xs text-red-700 py-4">
              {error}. The index is served from <code className="font-mono">/reference-index.json</code>.
            </p>
          )}

          {!error && !query.trim() && (
            <div className="py-4">
              <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-muted mb-2">
                Try
              </p>
              <ul className="space-y-1.5">
                {SUGGESTIONS.map(s => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => run(s)}
                      className="text-left text-xs text-brand-700 hover:underline"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-2xs text-ink-muted mt-5 leading-relaxed">
                Results are passages quoted from the documents, not generated answers — so nothing here can be
                invented, and a question spanning several sections returns several passages rather than one summary.
              </p>
            </div>
          )}

          {!error && query.trim() && !ready && (
            <p className="text-xs text-ink-muted py-4">Loading the index…</p>
          )}

          {ready && query.trim() && (
            <>
              {hits.length > 0 ? (
                <ul>
                  {hits.map(h => (
                    <Result key={h.chunk.id} hit={h} />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted py-4">
                  Nothing in the three documents matches that. It may be a product question rather than a strategy
                  one — try the Kasten documentation below.
                </p>
              )}

              {/* Product mechanics are deliberately out of scope: the three
                  documents cover strategy and operating model, not CLI syntax or
                  version support. Redirecting is more useful than a weak match. */}
              {(productish || hits.length === 0) && (
                <div className="my-4 rounded-lg border border-line bg-surface-sunken px-3 py-2.5">
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Looks like a product question. The reference documents cover strategy and operating model;
                    installation, commands and version support live in the Kasten documentation.
                  </p>
                  <a
                    href={kastenDocsSearchUrl(query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline mt-1.5"
                  >
                    Search docs.kasten.io for “{query.trim()}” <ExternalLinkIcon />
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-line">
          <p className="text-2xs text-ink-muted leading-relaxed">
            No question, answer or assessment data leaves this page. There is no model and no API call — the search
            index is a static file served alongside the app.
          </p>
        </div>
      </aside>
    </>
  );
}
