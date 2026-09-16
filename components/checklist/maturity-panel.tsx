"use client";

import { DIMENSIONS, type StatusMap } from "../../lib/checklist-data";
import { maturityEvidence, radarInputs } from "../../lib/maturity";
import { Marker } from "../ui/icon";
import { MaturityRadar } from "./maturity-radar";

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
    // No card chrome and no title of its own: /maturity sets this as a report,
    // so the page is the paper and its masthead carries the heading, the intro
    // and the workbook link. Rendering a bordered card inside a sheet would put
    // an edge around the middle of a document.
    <section>

      {/* Chart and headline side by side from `lg`, stacked below it.
          The radar is the leader's view — position at a glance — and the list
          beneath is the engineer's, naming the specific items. Both readers are
          served by the same panel rather than by two competing ones. */}
      {/* Column matches the radar's 400px viewBox exactly, so the chart can no
          longer paint over the headline the way it did with `overflow-visible`.
          `minmax(0,1fr)` on the second column rather than a bare `1fr`: without
          it a long unbroken word in the caveat can force the track wider than
          its share and push the chart out of its own column. */}
      <div className="mb-5 pb-5 border-b border-line grid lg:grid-cols-[400px_minmax(0,1fr)] gap-6 lg:gap-8 items-center">
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
        </div>
      </div>

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
                <span className="text-ink-muted">
                  {" "}
                  ({ev.passedCount}/{ev.taggedCount} items)
                </span>
              </div>
            </div>
            <div className="md:pt-0.5">
              {ev.blockingNextLevel.length > 0 && ev.nextLevel ? (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">
                    To evidence Level {ev.nextLevel}
                  </div>
                  <ul className="space-y-1">
                    {ev.blockingNextLevel.map(item => (
                      <li key={item.id} className="flex gap-2 text-[12px] text-ink-soft">
                        <Marker className="bg-amber-500" />
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

      <p className="text-xs text-ink-muted mt-6 pt-4 border-t border-line leading-relaxed">
        Next: download the workbook above, record Current and Target Level for each dimension on its{" "}
        <strong className="font-semibold text-ink-muted">Self-Assessment</strong> sheet (the second tab), then read the{" "}
        <strong className="font-semibold text-ink-muted">Recommendations</strong> tab for the level-transition actions.
        Reassess at least annually, or sooner after an incident, a drill, fleet growth or a new regulatory requirement.
        This panel is reproduced in the PDF export.
      </p>
    </section>
  );
}
