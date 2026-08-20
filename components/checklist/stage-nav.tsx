"use client";

import { STAGES, type StageId, type StatusMap, progressForStage } from "../../lib/checklist-data";

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

const GATE_STYLES = {
  clear: { dot: "bg-white", text: "Gate clear" },
  outstanding: { dot: "bg-amber-300", text: "Blockers open" },
  blocked: { dot: "bg-red-400", text: "Upstream blocked" },
} as const;

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
    <nav aria-label="Journey stages" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {STAGES.map((stage, i) => {
        const p = progressForStage(stage.id, statuses);
        const isActive = stage.id === active;
        const gate = GATE_STYLES[p.gate];
        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelect(stage.id)}
            aria-current={isActive ? "step" : undefined}
            className={`text-left rounded-xl border p-4 transition-all ${
              isActive
                ? "bg-[#219150] border-[#219150] text-white shadow-md"
                : "bg-white border-gray-200 hover:border-[#219150]/50 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isActive ? "text-white/70" : "text-gray-400"
                }`}
              >
                Stage {i + 1}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                  isActive ? "text-white/90" : "text-gray-500"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? gate.dot : ""} ${
                  !isActive
                    ? p.gate === "clear"
                      ? "bg-[#219150]"
                      : p.gate === "outstanding"
                        ? "bg-amber-500"
                        : "bg-red-500"
                    : ""
                }`} />
                {gate.text}
              </span>
            </div>
            <div className={`text-sm font-bold mb-1 ${isActive ? "text-white" : "text-gray-900"}`}>
              {stage.name}
            </div>
            <div className={`text-[11px] leading-snug mb-2 ${isActive ? "text-white/80" : "text-gray-500"}`}>
              {stage.strapline}
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-1.5 flex-1 rounded-full overflow-hidden ${isActive ? "bg-white/25" : "bg-gray-100"}`}>
                <div
                  className={`h-full rounded-full ${isActive ? "bg-white" : "bg-[#219150]"}`}
                  style={{ width: `${p.percent}%` }}
                />
              </div>
              <span className={`text-[10px] font-semibold tabular-nums ${isActive ? "text-white" : "text-gray-600"}`}>
                {p.passed}/{p.applicable}
              </span>
            </div>
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
 */
export function StageHeader({ stageId, statuses }: { stageId: StageId; statuses: StatusMap }) {
  const stage = STAGES.find(s => s.id === stageId)!;
  const p = progressForStage(stageId, statuses);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            {stage.roadmapPhase}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{stage.name}</h2>
          <p className="text-sm text-gray-600 max-w-3xl">{stage.goal}</p>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${
              p.gate === "clear"
                ? "bg-[#219150] text-white"
                : p.gate === "outstanding"
                  ? "bg-amber-500 text-white"
                  : "bg-red-600 text-white"
            }`}
          >
            {p.gate === "clear"
              ? "GATE CLEAR"
              : p.gate === "outstanding"
                ? `${p.blockersOutstanding.length} BLOCKING OPEN`
                : "UPSTREAM BLOCKED"}
          </div>
          <div className="text-[11px] text-gray-500 mt-2">
            {p.passed} verified · {p.failed} failed · {p.pending} pending · {p.na} N/A
          </div>
          <div className="text-[11px] text-gray-400">{stage.maturityTarget}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 pt-4 border-t border-gray-100">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Exit criteria</h3>
          <ul className="space-y-1.5">
            {stage.exitCriteria.map(c => (
              <li key={c} className="flex gap-2 text-[13px] text-gray-600">
                <span className="text-[#219150] mt-0.5 shrink-0">›</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            {p.gate === "clear" ? "Blocking items" : "Outstanding blocking items"}
          </h3>
          {p.upstreamBlockers.length > 0 && (
            <p className="text-[12px] text-red-600 mb-2 font-medium">
              {p.upstreamBlockers.length} blocking item{p.upstreamBlockers.length === 1 ? "" : "s"} outstanding in an
              earlier stage — clearing this stage does not make the environment ready.
            </p>
          )}
          {p.blockersOutstanding.length === 0 ? (
            <p className="text-[13px] text-gray-500">
              All blocking items in this stage are verified or ruled N/A.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {p.blockersOutstanding.map(item => (
                <li key={item.id} className="flex gap-2 text-[13px] text-gray-700">
                  <span className="text-red-500 mt-0.5 shrink-0">•</span>
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
