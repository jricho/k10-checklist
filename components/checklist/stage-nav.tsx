"use client";

import { STAGES, type StageId, type StatusMap, progressForStage } from "../../lib/checklist-data";
import { Panel } from "../ui/panel";
import { GATE } from "./gate";
import { ChevronRightIcon, Marker } from "../ui/icon";

// The journey, as navigation.
//
// The structural change from the original: one flat list of readiness items has
// become four ordered stages, because "production readiness" is not a single
// question. What a customer needs to prove two weeks into a POC and what they
// need to prove before a change board are different sets, and mixing them makes
// the POC look hopeless and the go-live look easy.
//
// Stages are always browsable — a customer will want to read ahead to see what is
// coming, and an established customer may start at Day-2. What is gated is the
// claim of readiness, not access to the questions.
//
// Visual note: the active stage is marked with a brand rule and a tinted surface
// rather than a solid green fill. A saturated block here competed with the gate
// badge below it, and the gate is the more important signal — a filled card tells
// you where you are, which you already know, while the gate tells you whether you
// can sign, which is the question.


export function StageNav({
  active,
  statuses,
  onSelect,
}: {
  active: StageId;
  statuses: StatusMap;
  onSelect: (stage: StageId) => void;
}) {
  return (
    // Shown below `lg` only: from there up the sticky sidebar carries navigation.
    <nav aria-label="Journey stages" className="lg:hidden grid grid-cols-2 gap-3 mb-5">
      {STAGES.map((stage, i) => {
        const p = progressForStage(stage.id, statuses);
        const isActive = stage.id === active;
        const gate = GATE[p.gate];
        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelect(stage.id)}
            aria-current={isActive ? "step" : undefined}
            className={`group relative text-left rounded-card border overflow-hidden transition-all duration-150 ${
              isActive
                ? "border-brand-600 bg-brand-50 shadow-card"
                : "border-line bg-surface hover:border-line-strong hover:shadow-card"
            }`}
          >
            {/* Position marker: a filled rule, not a filled card. */}
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 top-0 h-[3px] ${
                isActive ? "bg-brand-600" : "bg-transparent group-hover:bg-line-strong"
              }`}
            />
            <span className="block p-4 pt-[15px]">
              <span className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Stage {i + 1}
                </span>
                <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-ink-muted">
                  <span className={`w-1.5 h-1.5 rounded-full ${gate.dot}`} />
                  {gate.short}
                </span>
              </span>
              <span
                className={`block font-display text-sm font-semibold mb-1 ${
                  isActive ? "text-brand-900" : "text-ink"
                }`}
              >
                {stage.name}
              </span>
              <span className="block text-xs leading-snug text-ink-muted mb-2.5">
                {stage.strapline}
              </span>
              <span className="flex items-center gap-2">
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
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Stage header: goal, roadmap traceability, exit criteria, and the gate.
 *
 * The gate replaces the original percentage-based RAG light. An 80% threshold
 * showing GO is actively misleading on a readiness checklist, because the 20% not
 * done is not a random sample — it is the hard items, and "restore proven from an
 * exported restore point" is one of them. Blocking items are named individually
 * so the remaining work is a list, not a number.
 *
 * The badge is deliberately the largest, loudest object on the page. Everything
 * else on screen is a means of changing it.
 */
export function StageHeader({ stageId, statuses }: { stageId: StageId; statuses: StatusMap }) {
  const stage = STAGES.find(s => s.id === stageId)!;
  const p = progressForStage(stageId, statuses);
  const gate = GATE[p.gate];

  return (
    <Panel className="mb-5">
      <div className="px-5 py-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
        <div className="flex-1 min-w-0">
          <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted mb-1.5">
            {stage.roadmapPhase}
          </div>
          <h2 className="font-display text-xl font-semibold text-ink mb-2">{stage.name}</h2>
          <p className="text-sm text-ink-muted max-w-3xl leading-relaxed">{stage.goal}</p>
          {stage.playbookRefs && stage.playbookRefs.length > 0 && (
            <p className="text-xs text-ink-muted mt-2.5 leading-relaxed">
              Drawn from{" "}
              <a
                href="/kasten-resilience-playbook.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-700 hover:underline"
              >
                The Kasten Resilience Playbook
              </a>{" "}
              — {stage.playbookRefs.join(" · ")}
            </p>
          )}
        </div>

        <div className="shrink-0 lg:text-right">
          {/* The gate badge lives in the sticky sidebar from `lg` up, so it is
              always on screen; repeating it here would be two copies of the
              loudest element. Below `lg` there is no sidebar, so it stays. */}
          <div
            className={`lg:hidden inline-block rounded-lg px-4 py-2.5 font-display text-lg font-bold tracking-wide ${gate.badge}`}
          >
            {gate.label(p.blockersOutstanding.length)}
          </div>
          <dl className="mt-3 flex lg:justify-end gap-x-4 gap-y-1 flex-wrap text-2xs">
            <div className="flex items-center gap-1">
              <dt className="text-ink-muted">Verified</dt>
              <dd className="font-semibold tabular-nums text-ink">{p.passed}</dd>
            </div>
            <div className="flex items-center gap-1">
              <dt className="text-ink-muted">Failed</dt>
              <dd className={`font-semibold tabular-nums ${p.failed ? "text-red-700" : "text-ink"}`}>
                {p.failed}
              </dd>
            </div>
            <div className="flex items-center gap-1">
              <dt className="text-ink-muted">Pending</dt>
              <dd className="font-semibold tabular-nums text-ink">{p.pending}</dd>
            </div>
            <div className="flex items-center gap-1">
              <dt className="text-ink-muted">N/A</dt>
              <dd className="font-semibold tabular-nums text-ink">{p.na}</dd>
            </div>
          </dl>
          <p className="text-xs text-ink-muted mt-1.5">{stage.maturityTarget}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-x-8 gap-y-5 px-5 py-4 border-t border-line bg-surface-sunken">
        <div>
          <h3 className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted mb-2">
            Exit criteria
          </h3>
          <ul className="space-y-1.5">
            {stage.exitCriteria.map(c => (
              <li key={c} className="flex gap-2 text-xs text-ink-muted leading-relaxed">
                <ChevronRightIcon className="text-brand-600 mt-[0.15em]" />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted mb-2">
            {p.gate === "clear" ? "Blocking items" : "Outstanding blocking items"}
          </h3>
          {p.upstreamBlockers.length > 0 && (
            <p className="text-xs text-red-700 mb-2 font-medium leading-relaxed">
              {p.upstreamBlockers.length} blocking item{p.upstreamBlockers.length === 1 ? "" : "s"} outstanding in an
              earlier stage — clearing this stage does not make the environment ready.
            </p>
          )}
          {p.blockersOutstanding.length === 0 ? (
            <p className="text-xs text-ink-muted">
              All blocking items in this stage are verified or ruled N/A.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {p.blockersOutstanding.map(item => (
                <li key={item.id} className="flex gap-2 text-xs text-ink-muted leading-relaxed">
                  <Marker className="bg-red-500" />
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}
