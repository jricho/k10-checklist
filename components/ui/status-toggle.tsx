"use client";

import type { ItemStatus } from "../../lib/checklist-types";

// A three-state control replacing the plain checkbox.
//
// A checkbox can only say "done" or "not done", which forces two different
// situations into one state: "we have not looked at this yet" and "we looked and
// it does not apply to us". A single-cluster customer would score 0/3 on the
// multi-cluster section forever, dragging the completion figure down and making
// the number meaningless — so people stop trusting it.
//
// Separating N/A from pending also makes FAIL usable. An explicitly failed item
// is far more valuable in an evidence pack than a blank one: it records a known,
// accepted gap at the point of sign-off rather than an unanswered question.
//
// Visual treatment: a segmented control rather than three separate buttons. It
// reads as one decision with three answers, which is what it is, and it occupies
// a fixed width so 112 rows of them form a clean column rather than a ragged
// edge. Inactive segments are near-invisible so a page of unanswered items looks
// calm; the selected segment is the only saturated thing in the row.

const OPTIONS: { value: ItemStatus; label: string; title: string }[] = [
  { value: "pass", label: "Pass", title: "Verified in this environment" },
  { value: "fail", label: "Fail", title: "Assessed and found wanting — a known gap" },
  { value: "na", label: "N/A", title: "Does not apply here — record why in the note" },
];

const ACTIVE: Record<ItemStatus, string> = {
  pass: "bg-brand-700 text-white border-brand-700",
  fail: "bg-red-500 text-white border-red-500",
  na: "bg-ink-faint text-white border-ink-faint",
  pending: "",
};

export function StatusToggle({
  status,
  onChange,
  itemLabel,
}: {
  status: ItemStatus;
  onChange: (status: ItemStatus) => void;
  itemLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`Status for: ${itemLabel}`}
      className="inline-flex rounded-lg border border-line overflow-hidden shrink-0 bg-surface"
    >
      {OPTIONS.map(opt => {
        const active = status === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            // Clicking the active option clears it back to pending, so a
            // mis-click is recoverable without a separate reset control.
            onClick={() => onChange(active ? "pending" : opt.value)}
            className={`w-12 py-1.5 text-2xs font-semibold border-r last:border-r-0 transition-colors ${
              active
                ? ACTIVE[opt.value]
                : "border-line text-ink-faint hover:bg-surface-sunken hover:text-ink-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusPill({ status }: { status: ItemStatus }) {
  if (status === "pending") return null;
  const text = status === "pass" ? "Pass" : status === "fail" ? "Fail" : "N/A";
  return (
    <span
      className={`text-2xs font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border ${ACTIVE[status]}`}
    >
      {text}
    </span>
  );
}
