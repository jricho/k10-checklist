"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StageNav, StageHeader } from "./stage-nav";
import { Sidebar } from "./sidebar";
import { SectionCard } from "./section-card";
import { PillarFilter } from "./pillar-filter";
import { useAssessmentContext } from "./assessment-provider";
import { STAGES_BY_ID, itemsForStage, type PillarId } from "../../lib/checklist-data";
import type { StageId } from "../../lib/checklist-types";

// One stage of the assessment, at its own URL.
//
// The stage now comes from the route rather than from component state, which is
// what makes a stage linkable — "the go-live gate is blocked on these four
// items" is a sentence people send, and it needs a URL. `activeStage` in the
// saved assessment survives as *last visited*, written here on arrival, so the
// landing page can offer a Continue that lands where the work stopped.

export function StageChecklist({ stageId }: { stageId: StageId }) {
  const { ctrl } = useAssessmentContext();
  const { assessment, setStatus, setNote, setActiveStage } = ctrl;
  const { statuses, notes } = assessment;

  // Deliberately component state, not persisted. A filter restored on load would
  // hide items without the click that explains why — see pillar-filter.tsx.
  const [pillar, setPillar] = useState<PillarId | null>(null);

  // Record where the customer got to. Guarded so it does not write on every
  // render, and so opening a stage you were already on is not a state change.
  useEffect(() => {
    if (assessment.activeStage !== stageId) setActiveStage(stageId);
  }, [stageId, assessment.activeStage, setActiveStage]);

  const stage = STAGES_BY_ID[stageId];

  return (
    <main className="max-w-[86rem] mx-auto px-6 py-7">
      <div className="mb-5">
        <Link href="/" className="text-xs font-semibold text-ink-muted hover:text-brand-700">
          ← Overview
        </Link>
      </div>

      {ctrl.persistError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"
        >
          {ctrl.persistError}
        </div>
      )}

      {/* Two columns from `lg` up: sticky rail plus content. Below that the
          rail is hidden and StageNav supplies navigation inline. */}
      <div className="flex gap-6 items-start">
        <Sidebar activeStage={stageId} statuses={statuses} />

        <div className="flex-1 min-w-0">
          <div className="reveal" style={{ "--reveal-index": "0" } as React.CSSProperties}>
            <StageNav active={stageId} statuses={statuses} />
            <StageHeader stageId={stageId} statuses={statuses} />
          </div>

          <div className="reveal" style={{ "--reveal-index": "1" } as React.CSSProperties}>
            <PillarFilter
              items={itemsForStage(stageId)}
              statuses={statuses}
              active={pillar}
              onChange={setPillar}
            />

            <div className="space-y-5">
              {stage.sections.map(section => (
                <SectionCard
                  key={section.id}
                  section={section}
                  statuses={statuses}
                  notes={notes}
                  onStatus={setStatus}
                  onNote={setNote}
                  pillar={pillar}
                />
              ))}
            </div>
          </div>

          <p className="mt-8 text-xs text-ink-muted">
            Workload tiers and RPO/RTO targets, which every disaster recovery item is assessed against, are
            recorded on the{" "}
            <Link href="/" className="font-semibold text-brand-700 hover:underline">
              overview
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
