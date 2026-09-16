"use client";

import Link from "next/link";
import { MaturityPanel } from "../../../components/checklist/maturity-panel";
import { useAssessmentContext } from "../../../components/checklist/assessment-provider";
import { DownloadIcon } from "../../../components/ui/icon";

// The maturity model in full, set as a report rather than as an instrument.
//
// Everywhere else in this app the page is a tinted ground carrying white cards,
// because everywhere else there is work to do and the cards are where you do it.
// There is no work here: every number is derived from the checklist, and an
// input on this route would be a second, competing place to record the same
// evidence. So the page becomes the paper — one white column, wide margins, a
// rule under the masthead, no sidebar and no card edges.
//
// That is not decoration. This panel is reproduced in the PDF export, and it is
// the thing a customer forwards to someone who was not in the room. Making the
// screen and the export read as the same document is the point; a reader who
// has seen one should recognise the other.
//
// Statuses come from the provider, so ticking an item on a stage route is
// reflected here without a save step.

export default function MaturityPage() {
  const { ctrl } = useAssessmentContext();
  const { statuses, meta } = ctrl.assessment;

  const identity = [meta.project, meta.clusterName, meta.date].filter(Boolean).join(" · ");

  return (
    // border-x rather than a shadow: a report is a sheet, not a floating card.
    <main className="max-w-[55rem] mx-auto bg-surface border-x border-line px-6 sm:px-12 lg:px-16 pt-8 pb-14">
      <Link
        href="/"
        className="inline-block mb-8 text-xs font-semibold text-ink-muted hover:text-brand-700"
      >
        ← Overview
      </Link>

      <div className="border-b-2 border-ink pb-4 mb-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2.5">
          <span className="font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Operating maturity · derived report
          </span>
          {identity && <span className="text-2xs text-ink-faint tabular-nums">{identity}</span>}
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">Maturity breakdown</h1>
      </div>

      {/* Stacks below `sm`. Side by side, the workbook link is ~220px that will
          not shrink, which on a phone left the paragraph a 110px ragged column
          one or two words wide. */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-x-8 gap-y-4 mb-9">
        <p className="text-base text-ink-soft leading-relaxed max-w-[64ch] sm:flex-1 sm:min-w-0">
          All seven dimensions of the Kasten Maturity Model, the level each one&apos;s evidence currently
          supports, and the items standing between it and the next one. This is evidence, not a score — the
          companion workbook remains authoritative, because half of each dimension is process and ownership
          that no command can observe.
        </p>
        {/* Served from public/ so a self-hosted, air-gapped deployment still has
            the workbook to hand. Keep it in step with the canonical version —
            see README. */}
        <a
          href="/kasten-maturity-self-assessment.xlsx"
          download
          className="shrink-0 text-xs font-semibold text-brand-700 hover:underline"
        >
          Download the workbook (.xlsx) <DownloadIcon />
        </a>
      </div>

      <MaturityPanel statuses={statuses} />
    </main>
  );
}
