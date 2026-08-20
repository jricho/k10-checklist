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
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-base font-semibold text-gray-900">Maturity signals observed</h2>
        <span className="text-xs text-gray-400 shrink-0">Kasten Maturity Model · 7 dimensions</span>
      </div>
      <p className="text-[13px] text-gray-500 mb-5 max-w-3xl leading-relaxed">
        What the verified items support, mapped onto the maturity model. This is evidence, not a score — the
        companion self-assessment workbook remains authoritative, because half of each dimension is process and
        ownership that no command can observe. Use the evidenced level as the starting point for the workbook&apos;s
        Current Level, and the outstanding items as the work that would justify the next one.
      </p>

      {scored.length > 0 && (
        <div className="flex items-baseline gap-3 mb-5 pb-5 border-b border-gray-100">
          <span className="text-3xl font-bold text-gray-900 tabular-nums">L{average.toFixed(1)}</span>
          <span className="text-[13px] text-gray-500">
            average across the {scored.length} dimension{scored.length === 1 ? "" : "s"} with complete evidence
          </span>
        </div>
      )}

      <div className="space-y-4">
        {evidence.map(ev => (
          <div key={ev.dimension} className="grid md:grid-cols-[220px_1fr] gap-3 md:gap-5">
            <div>
              <div className="text-[13px] font-semibold text-gray-800 leading-snug">
                {DIMENSIONS[ev.dimension].name}
              </div>
              <div className="flex items-center gap-1 mt-1.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map(l => (
                  <span
                    key={l}
                    className={`h-1.5 w-6 rounded-full ${
                      l <= ev.evidencedLevel ? "bg-[#219150]" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {ev.evidencedLevel > 0
                  ? `Evidence supports L${ev.evidencedLevel} — ${LEVEL_LABELS[ev.evidencedLevel]}`
                  : "No level fully evidenced yet"}
                <span className="text-gray-400">
                  {" "}
                  ({ev.passedCount}/{ev.taggedCount} items)
                </span>
              </div>
            </div>
            <div className="md:pt-0.5">
              {ev.blockingNextLevel.length > 0 && ev.nextLevel ? (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                    To evidence Level {ev.nextLevel}
                  </div>
                  <ul className="space-y-1">
                    {ev.blockingNextLevel.map(item => (
                      <li key={item.id} className="flex gap-2 text-[12px] text-gray-600">
                        <span className="text-amber-500 shrink-0">•</span>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-[12px] text-gray-500">
                  {ev.evidencedLevel === 5
                    ? "All associated items verified — sustaining practices apply. Reassess annually."
                    : "No further checklist evidence defined for this dimension; score it on judgement in the workbook."}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-gray-400 mt-6 pt-4 border-t border-gray-100 leading-relaxed">
        Next: record Current and Target Level for each dimension in the Self-Assessment sheet of the workbook, then
        read the Recommendations tab for the level-transition actions. Reassess at least annually, or sooner after an
        incident, a drill, fleet growth or a new regulatory requirement. This panel is reproduced in the PDF export.
      </p>
    </section>
  );
}
