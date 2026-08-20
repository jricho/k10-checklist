"use client";

import { DIMENSIONS, type StatusMap } from "../../lib/checklist-data";
import { maturityEvidence } from "../../lib/maturity";

// The visible link between this tool and the Resilience Playbook.
//
// Deliberately framed as evidence rather than as a score. The workbook stays the
// authoritative instrument — process, ownership and cadence are half of every
// dimension's descriptor and none of it is observable from a cluster. What this
// panel does is remove the guesswork from filling the workbook in: it shows which
// level the verified items already support, and names the specific items standing
// between the customer and the next one.
//
// It also answers the question customers actually ask at the end of a POC, which
// is not "are we ready" but "what do we do next" — and answers it with a list of
// three things rather than a five-level model to interpret.

const LEVEL_LABELS = ["—", "Ad Hoc", "Foundational", "Managed", "Resilient", "Adaptive"];

export function MaturityPanel({ statuses }: { statuses: StatusMap }) {
  const evidence = maturityEvidence(statuses);
  const scored = evidence.filter(e => e.evidencedLevel > 0);
  const average =
    scored.length > 0 ? scored.reduce((n, e) => n + e.evidencedLevel, 0) / scored.length : 0;

  return (
    <section className="bg-surface rounded-card border border-line shadow-card p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-base font-semibold text-ink">Maturity signals observed</h2>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-ink-faint">Kasten Maturity Model · 7 dimensions</span>
          {/* Served from public/ so a self-hosted, air-gapped deployment still
              has the workbook to hand. Keep it in step with the canonical
              version — see README. */}
          <a
            href="/kasten-maturity-self-assessment.xlsx"
            download
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            Download the workbook (.xlsx) ↓
          </a>
        </div>
      </div>
      <p className="text-[13px] text-ink-muted mb-5 max-w-3xl leading-relaxed">
        What the verified items support, mapped onto the maturity model. This is evidence, not a score — the
        companion self-assessment workbook remains authoritative, because half of each dimension is process and
        ownership that no command can observe. Use the evidenced level as the starting point for the workbook&apos;s
        Current Level, and the outstanding items as the work that would justify the next one.
      </p>

      {scored.length > 0 && (
        <div className="flex items-baseline gap-3 mb-5 pb-5 border-b border-line">
          <span className="text-3xl font-bold text-ink tabular-nums">L{average.toFixed(1)}</span>
          <span className="text-[13px] text-ink-muted">
            average across the {scored.length} dimension{scored.length === 1 ? "" : "s"} with complete evidence
          </span>
        </div>
      )}

      <div className="space-y-4">
        {evidence.map(ev => (
          <div key={ev.dimension} className="grid md:grid-cols-[220px_1fr] gap-3 md:gap-5">
            <div>
              <div className="text-[13px] font-semibold text-ink leading-snug">
                {DIMENSIONS[ev.dimension].name}
              </div>
              <div className="flex items-center gap-1 mt-1.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map(l => (
                  <span
                    key={l}
                    className={`h-1.5 w-6 rounded-full ${
                      // brand-600 rather than the raw #00b356 accent: the
                      // brand green measures 2.46:1 against this track, below
                      // the 3:1 floor for a non-text indicator. brand-600 keeps
                      // the energy at 4.08:1.
                      l <= ev.evidencedLevel ? "bg-brand-600" : "bg-line"
                    }`}
                  />
                ))}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">
                {ev.evidencedLevel > 0
                  ? `Evidence supports L${ev.evidencedLevel} — ${LEVEL_LABELS[ev.evidencedLevel]}`
                  : "No level fully evidenced yet"}
                <span className="text-ink-faint">
                  {" "}
                  ({ev.passedCount}/{ev.taggedCount} items)
                </span>
              </div>
            </div>
            <div className="md:pt-0.5">
              {ev.blockingNextLevel.length > 0 && ev.nextLevel ? (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint mb-1">
                    To evidence Level {ev.nextLevel}
                  </div>
                  <ul className="space-y-1">
                    {ev.blockingNextLevel.map(item => (
                      <li key={item.id} className="flex gap-2 text-[12px] text-ink-soft">
                        <span className="text-amber-500 shrink-0">•</span>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-[12px] text-ink-muted">
                  {ev.evidencedLevel === 5
                    ? "All associated items verified — sustaining practices apply. Reassess annually."
                    : "No further checklist evidence defined for this dimension; score it on judgement in the workbook."}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-ink-faint mt-6 pt-4 border-t border-line leading-relaxed">
        Next: download the workbook above, record Current and Target Level for each dimension on its{" "}
        <strong className="font-semibold text-ink-muted">Self-Assessment</strong> sheet (the second tab), then read the{" "}
        <strong className="font-semibold text-ink-muted">Recommendations</strong> tab for the level-transition actions.
        Reassess at least annually, or sooner after an incident, a drill, fleet growth or a new regulatory requirement.
        This panel is reproduced in the PDF export.
      </p>
    </section>
  );
}
