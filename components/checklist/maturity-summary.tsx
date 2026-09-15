"use client";

import Link from "next/link";
import type { StatusMap } from "../../lib/checklist-data";
import { maturityEvidence, radarInputs, weakestDimensions } from "../../lib/maturity";
import { Marker } from "../ui/icon";
import { MaturityRadar } from "./maturity-radar";

// The maturity readout as it appears on the checklist page.
//
// The full panel had grown to a radar, a headline, seven dimension rows and a
// per-dimension list of outstanding items — a page in its own right, sitting
// two-thirds of the way down a page that already holds 112 checklist rows. The
// split is by reader rather than by size: what belongs next to the checklist is
// the position and the next three things to do, because those are what change
// as items are ticked. The seven-dimension breakdown is a report you read once
// a sitting, so it lives on /maturity.
//
// The radar stays here rather than moving with the detail. It is the only part
// that answers "where are we" without being read — and the shape is what a
// customer's leadership looks at, so it belongs on the page they are shown.

export function MaturitySummary({ statuses }: { statuses: StatusMap }) {
  const evidence = maturityEvidence(statuses);
  const scored = evidence.filter(e => e.evidencedLevel > 0);
  const average =
    scored.length > 0 ? scored.reduce((n, e) => n + e.evidencedLevel, 0) / scored.length : 0;
  const weakest = weakestDimensions(statuses, 3);

  return (
    // Anchor target retained: the sidebar and the narrow-viewport chip row both
    // point at #maturity, and that should still land on the page you are on
    // rather than silently becoming a route change.
    <section id="maturity" className="scroll-mt-20 bg-surface rounded-card border border-line shadow-card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Maturity signals observed</h2>
          <p className="text-xs text-ink-muted mt-0.5">Kasten Maturity Model · 7 dimensions</p>
        </div>
        <Link
          href="/maturity"
          className="shrink-0 text-xs font-semibold text-brand-700 hover:underline"
        >
          Full breakdown →
        </Link>
      </div>

      {/* Column matches the radar's 400px viewBox exactly, so the chart cannot
          paint over the text beside it. `minmax(0,1fr)` rather than a bare
          `1fr`: without it a long unbroken word can force the track wider than
          its share and push the chart out of its own column. */}
      <div className="grid lg:grid-cols-[400px_minmax(0,1fr)] gap-6 lg:gap-8 items-center">
        <MaturityRadar inputs={radarInputs(statuses)} />

        <div>
          {scored.length > 0 ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-ink tabular-nums">L{average.toFixed(1)}</span>
                <span className="text-[13px] text-ink-muted">
                  average across the {scored.length} dimension{scored.length === 1 ? "" : "s"} with complete
                  evidence
                </span>
              </div>
              {/* The average is reported because the workbook asks for one, and
                  immediately qualified because a mean across seven dimensions
                  hides the only number that governs risk: the lowest. */}
              <p className="text-[12px] text-ink-muted mt-2 leading-relaxed max-w-md">
                Treat the average as reporting, not as a target. Recoverability is limited by the weakest
                dimension, not by the mean of the seven — the shape of the chart matters more than its area.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-ink-muted leading-relaxed max-w-md">
              No dimension yet has a complete level of evidence. A level appears here once every item tagged to
              it — at that level and every level below — is either passing or ruled N/A.
            </p>
          )}

          {/* Where effort buys the most. Three rather than seven: this is the
              "what next" answer, and a list of seven is a report, not an
              answer. The rest are one click away. */}
          <div className="mt-5 pt-4 border-t border-line">
            <h3 className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted mb-2">
              Weakest three dimensions
            </h3>
            <ul className="space-y-1.5">
              {weakest.map(ev => (
                <li key={ev.dimension} className="flex items-baseline gap-2 text-[12px]">
                  <Marker className="bg-amber-500" />
                  <span className="flex-1 text-ink-soft">{ev.name}</span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {ev.evidencedLevel > 0 ? `L${ev.evidencedLevel}` : "—"} · {ev.passedCount}/
                    {ev.taggedCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
