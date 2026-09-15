"use client";

import Link from "next/link";
import type { StatusMap } from "../../lib/checklist-data";
import { maturityEvidence, radarInputs, weakestDimensions } from "../../lib/maturity";
import { MaturityRadar } from "./maturity-radar";
import { ROUTES } from "../../lib/routes";

// The maturity readout as it appears on the overview: shape, level, and the one
// dimension carrying the most risk.
//
// Smaller than the panel it replaces. The overview's job is to send you
// somewhere, so this carries only what survives being read in two seconds — the
// radar because position is legible without reading, the average because the
// workbook asks for one, and the weakest dimension because recoverability is
// limited by it rather than by the mean. The seven-dimension breakdown is a
// report you read once a sitting, and it lives at /maturity.

export function MaturityTile({ statuses }: { statuses: StatusMap }) {
  const evidence = maturityEvidence(statuses);
  const scored = evidence.filter(e => e.evidencedLevel > 0);
  const average =
    scored.length > 0 ? scored.reduce((n, e) => n + e.evidencedLevel, 0) / scored.length : 0;
  const weakest = weakestDimensions(statuses, 1)[0];

  return (
    <section className="bg-surface rounded-card border border-line shadow-card p-5">
      <div className="flex items-start gap-4">
        <div className="w-[104px] shrink-0 -my-2">
          <MaturityRadar inputs={radarInputs(statuses)} compact />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink mb-1">Assess operating maturity</h2>
          <p className="text-[13px] text-ink-muted leading-relaxed mb-3">
            Seven dimensions, levelled from evidence you have already recorded.
          </p>
          {scored.length > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-ink tabular-nums">L{average.toFixed(1)}</span>
              <span className="text-2xs text-ink-muted">
                {scored.length} of 7 dimension{scored.length === 1 ? "" : "s"} evidenced
              </span>
            </div>
          ) : (
            <p className="text-2xs text-ink-muted">No dimension yet has a complete level of evidence.</p>
          )}
        </div>
      </div>

      <div className="border-t border-line mt-4 pt-3 flex items-center justify-between gap-3">
        <span className="text-2xs text-ink-muted truncate">Weakest: {weakest.name}</span>
        <Link
          href={ROUTES.maturity}
          className="text-xs font-semibold text-brand-700 hover:underline shrink-0"
        >
          Open the report →
        </Link>
      </div>
    </section>
  );
}
