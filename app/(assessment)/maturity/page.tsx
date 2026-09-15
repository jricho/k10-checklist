"use client";

import Link from "next/link";
import { MaturityPanel } from "../../../components/checklist/maturity-panel";
import { useAssessmentContext } from "../../../components/checklist/assessment-provider";

// The maturity model in full.
//
// Reads the same assessment as the checklist — statuses come from the provider,
// so ticking an item on / is reflected here without a save step. Nothing on this
// route is editable: every number is derived from the checklist, and an input
// here would be a second, competing place to record the same evidence.

export default function MaturityPage() {
  const { ctrl } = useAssessmentContext();
  const { statuses } = ctrl.assessment;

  return (
    <main className="max-w-[86rem] mx-auto px-6 py-7">
      <header className="mb-6">
        <p className="font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-ink-muted mb-2">
          Veeam Kasten · Operating maturity
        </p>
        <h1 className="font-display text-2xl font-bold text-ink mb-3">Maturity breakdown</h1>
        <p className="text-base text-ink-soft max-w-[70ch] leading-relaxed">
          All seven dimensions of the Kasten Maturity Model, the level each one&apos;s evidence currently
          supports, and the specific checklist items standing between it and the next level. Derived from the
          checklist — nothing here is entered separately.
        </p>
        <Link href="/#maturity" className="inline-block mt-4 text-xs font-semibold text-brand-700 hover:underline">
          ← Back to the checklist
        </Link>
      </header>

      <MaturityPanel statuses={statuses} />
    </main>
  );
}
