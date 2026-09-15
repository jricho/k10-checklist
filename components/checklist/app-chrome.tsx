"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReferenceDrawer } from "./reference-drawer";
import { useAssessmentContext } from "./assessment-provider";
import { overallProgress } from "../../lib/checklist-data";
import { ROUTES, stageHref } from "../../lib/routes";
import {
  downloadJson,
  exportAssessmentPdf,
  EXPORT_SCOPE_LABELS,
  type ExportScope,
} from "../../lib/export-pdf";

// The chrome that every assessment route shares: masthead bar, route tabs,
// reference drawer, footer.
//
// It moved out of the page because the actions in it are not the page's. Export
// PDF renders the whole assessment including the diagram attached on
// /diagnostics; Open and Save read and write the entire document; Ask searches
// the reference set regardless of what is on screen. Leaving them on the
// checklist page would mean either duplicating them per route or making the
// other two routes dead ends you can only leave with the back button.
//
// Scoped to the route group rather than the root layout deliberately:
// /legacy carries its own header and footer, and would render two of each.

// `match` decides which tab is lit. The four stage routes live under
// /assessment/<slug>, so that tab is active for any of them rather than for one
// exact path — without the prefix test, walking the journey would leave no tab
// marked at all.
const TABS = [
  { href: ROUTES.overview, label: "Overview", match: (p: string) => p === ROUTES.overview },
  { href: stageHref("poc"), label: "Assessment", match: (p: string) => p.startsWith("/assessment") },
  { href: ROUTES.maturity, label: "Maturity", match: (p: string) => p === ROUTES.maturity },
  {
    href: ROUTES.clusterCapture,
    label: "Cluster Capture",
    match: (p: string) => p === ROUTES.clusterCapture,
  },
] as const;

export function AppChrome({ children }: { children: React.ReactNode }) {
  const { ctrl, diagram } = useAssessmentContext();
  const { assessment } = ctrl;
  const { meta, statuses } = assessment;

  const [exporting, setExporting] = useState(false);
  // Defaults to the stage being viewed plus everything before it: a gate's
  // sign-off needs the upstream evidence, but not the stages still ahead.
  const [exportScope, setExportScope] = useState<ExportScope>("through");
  const [askOpen, setAskOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const pathname = usePathname();
  const overall = overallProgress(statuses);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportAssessmentPdf({ assessment, diagram, scope: exportScope });
    } finally {
      setExporting(false);
    }
  };

  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        ctrl.load(JSON.parse(String(reader.result ?? "{}")));
      } catch {
        window.alert("That file could not be read as a saved assessment.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b border-line shadow-sm sticky top-0 z-20">
        {/* `flex-wrap` and a shrinking action cluster: this row previously held
            six controls at `shrink-0`, which set a 469px floor and made the
            whole document 509px wide on a 390px screen — every page scrolled
            sideways. See the closed overflow issue. */}
        <div className="max-w-[86rem] mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <Image
              src="/veeam_logo.svg"
              alt="Veeam"
              width={140}
              height={36}
              className="h-8 w-auto"
              unoptimized
              priority
            />
            <div className="hidden sm:block h-7 w-px bg-line-strong" />
            <span className="hidden sm:block text-xs font-medium text-ink-muted tracking-wide uppercase truncate">
              Readiness &amp; Operating Maturity
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
            <span className="hidden md:block text-xs text-ink-muted tabular-nums mr-1">
              {overall.passed}/{overall.applicable} overall
            </span>
            {/* Retrieval over the three reference documents. Labelled "Ask" but
                deliberately a search surface, not a chat one — see the drawer. */}
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-brand-700 border border-line rounded-lg px-2.5 py-2"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="6" />
                <path strokeLinecap="round" d="M20 20l-4.5-4.5" />
              </svg>
              Ask
            </button>
            <input ref={fileInput} type="file" accept=".json" className="hidden" onChange={handleLoadJson} />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="text-xs font-semibold text-ink-soft hover:text-brand-700 px-2 py-2"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() =>
                downloadJson(
                  `kasten-assessment-${meta.project ? meta.project.replace(/\s+/g, "-").toLowerCase() + "-" : ""}${meta.date}.json`,
                  ctrl.exportJson(),
                )
              }
              className="text-xs font-semibold text-ink-soft hover:text-brand-700 px-2 py-2"
            >
              Save
            </button>
            <label htmlFor="export-scope" className="sr-only">
              PDF export scope
            </label>
            <select
              id="export-scope"
              value={exportScope}
              onChange={e => setExportScope(e.target.value as ExportScope)}
              title="How much of the journey the exported PDF covers"
              className="text-xs font-medium text-ink-soft border border-line-strong rounded-lg px-2 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-brand-600 max-w-[10rem]"
            >
              {(Object.keys(EXPORT_SCOPE_LABELS) as ExportScope[]).map(key => (
                <option key={key} value={key}>
                  {EXPORT_SCOPE_LABELS[key]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex items-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                />
              </svg>
              {exporting ? "Building…" : "Export PDF"}
            </button>
          </div>
        </div>

        {/* Route tabs. The three views are now separate documents rather than
            one scroll, so navigation between them belongs in the chrome — a
            jump link cannot reach another route, and the sidebar only exists on
            the checklist. */}
        <nav
          aria-label="Assessment views"
          className="max-w-[86rem] mx-auto px-6 flex items-center gap-1 -mb-px overflow-x-auto"
        >
          {TABS.map(tab => {
            const isActive = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`shrink-0 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-brand-600 text-brand-800"
                    : "border-transparent text-ink-muted hover:text-ink hover:border-line-strong"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {children}

      <ReferenceDrawer open={askOpen} onClose={() => setAskOpen(false)} />

      <footer className="mt-12 border-t border-line bg-surface">
        <div className="max-w-[86rem] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-ink-faint">
            &copy; {new Date().getFullYear()} Veeam Software. Assessment data stays in your browser — this app has no
            backend and no cluster access.
          </span>
          <span className="flex items-center gap-4">
            {/* Temporary while the four-stage version is under review — remove
                this link and app/legacy/ once it is signed off. */}
            <Link href="/legacy" className="text-xs text-ink-faint hover:text-ink-soft hover:underline">
              Previous version
            </Link>
            <a
              href="https://docs.kasten.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-700 hover:underline"
            >
              docs.kasten.io
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
