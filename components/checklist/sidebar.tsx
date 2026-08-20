"use client";

import {
  STAGES,
  progressForStage,
  statusOf,
  type StageId,
  type StatusMap,
} from "../../lib/checklist-data";
import { overallProgress } from "../../lib/checklist-data";
import { GATE } from "./gate";

// Left rail.
//
// The landing area had grown to four stage cards, a details card, a stage header
// and a reference row before a single checklist item appeared — roughly a full
// screen of chrome ahead of the content. Moving navigation into a sticky rail
// fixes two things at once: the main column starts with the work, and the gate
// badge stops scrolling away, so the answer to "can we sign this" is on screen
// permanently rather than only at the top of the page.
//
// Hidden below `lg`. On a narrow viewport a 16rem rail would eat the column that
// has to hold 112 dense rows, so small screens keep the horizontal stage nav
// instead. That is a deliberate divergence, not an oversight.

export function Sidebar({
  activeStage,
  statuses,
  onSelect,
}: {
  activeStage: StageId;
  statuses: StatusMap;
  onSelect: (stage: StageId) => void;
}) {
  const active = STAGES.find(s => s.id === activeStage)!;
  const activeProgress = progressForStage(activeStage, statuses);
  const gate = GATE[activeProgress.gate];
  const overall = overallProgress(statuses);

  return (
    <aside
      aria-label="Assessment navigation"
      // Offset matches the sticky header height so the rail tucks underneath it.
      className="hidden lg:block w-60 xl:w-64 shrink-0 sticky top-[61px] self-start max-h-[calc(100vh-77px)] overflow-y-auto pb-4"
    >
      {/* Gate — pinned, and the reason the rail exists. */}
      <div
        className={`rounded-card px-4 py-3 mb-3 font-display text-sm font-bold tracking-wide text-center ${gate.badge}`}
      >
        {gate.label(activeProgress.blockersOutstanding.length)}
        <span className="block font-sans text-2xs font-medium tracking-normal opacity-90 mt-0.5">
          {active.name}
        </span>
      </div>

      <nav className="bg-surface border border-line rounded-card shadow-card overflow-hidden">
        <h2 className="px-3 py-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted border-b border-line bg-surface-sunken">
          Journey
        </h2>
        <ol>
          {STAGES.map((stage, i) => {
            const p = progressForStage(stage.id, statuses);
            const isActive = stage.id === activeStage;
            const g = GATE[p.gate];
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  onClick={() => onSelect(stage.id)}
                  aria-current={isActive ? "step" : undefined}
                  className={`group relative w-full text-left px-3 py-2.5 border-b border-line last:border-b-0 transition-colors ${
                    isActive ? "bg-brand-50" : "hover:bg-surface-sunken"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                      isActive ? "bg-brand-600" : "bg-transparent"
                    }`}
                  />
                  <span className="flex items-center gap-2">
                    <span
                      className={`font-mono text-2xs font-semibold ${
                        isActive ? "text-brand-800" : "text-ink-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`flex-1 text-xs font-semibold truncate ${
                        isActive ? "text-brand-900" : "text-ink"
                      }`}
                    >
                      {stage.name}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${g.dot}`} />
                  </span>
                  <span className="flex items-center gap-2 mt-1.5 pl-5">
                    <span className="h-1 flex-1 rounded-full overflow-hidden bg-line">
                      <span
                        className="block h-full rounded-full bg-brand-600 transition-[width] duration-300"
                        style={{ width: `${p.percent}%` }}
                      />
                    </span>
                    <span className="text-2xs font-semibold tabular-nums text-ink-muted">
                      {p.passed}/{p.applicable}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Section jump list for the stage in view. */}
      <nav className="bg-surface border border-line rounded-card shadow-card overflow-hidden mt-3">
        <h2 className="px-3 py-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted border-b border-line bg-surface-sunken">
          Sections
        </h2>
        <ul>
          {active.sections.map(section => {
            const done = section.items.filter(i => {
              const s = statusOf(statuses, i.id);
              return s === "pass" || s === "na";
            }).length;
            const blockers = section.items.filter(
              i => i.blocking && !["pass", "na"].includes(statusOf(statuses, i.id)),
            ).length;
            const complete = done === section.items.length;
            return (
              <li key={section.id}>
                <a
                  href={`#section-${section.id}`}
                  className="flex items-start gap-2 px-3 py-2 border-b border-line last:border-b-0 hover:bg-surface-sunken transition-colors group"
                >
                  <span className="flex-1 text-2xs leading-snug text-ink-soft group-hover:text-ink">
                    {section.title}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {blockers > 0 && (
                      <span
                        title={`${blockers} blocking item${blockers === 1 ? "" : "s"} outstanding`}
                        className="w-1.5 h-1.5 rounded-full bg-red-500"
                      />
                    )}
                    <span
                      className={`text-2xs font-semibold tabular-nums ${
                        complete ? "text-brand-700" : "text-ink-muted"
                      }`}
                    >
                      {done}/{section.items.length}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-3 px-3 py-2.5 rounded-card border border-line bg-surface-sunken">
        <div className="flex items-baseline justify-between">
          <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
            All stages
          </span>
          <span className="text-xs font-bold tabular-nums text-ink">
            {overall.passed}/{overall.applicable}
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden bg-line mt-2">
          <div
            className="h-full rounded-full bg-brand-600"
            style={{ width: `${overall.percent}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
