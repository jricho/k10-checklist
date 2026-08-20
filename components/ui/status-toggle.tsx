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

const OPTIONS: { value: ItemStatus; label: string; title: string }[] = [
  { value: "pass", label: "Pass", title: "Verified in this environment" },
  { value: "fail", label: "Fail", title: "Assessed and found wanting — a known gap" },
  { value: "na", label: "N/A", title: "Does not apply here — record why in the note" },
];

const STYLES: Record<ItemStatus, string> = {
  pass: "bg-[#219150] text-white border-[#219150]",
  fail: "bg-red-600 text-white border-red-600",
  na: "bg-gray-400 text-white border-gray-400",
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
      className="inline-flex rounded-md border border-gray-300 overflow-hidden shrink-0"
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
            className={`px-2.5 py-1 text-[11px] font-semibold transition-colors border-r last:border-r-0 border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#219150] ${
              active ? STYLES[opt.value] : "bg-white text-gray-500 hover:bg-gray-50"
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
    <span className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 ${STYLES[status]}`}>
      {text}
    </span>
  );
}
