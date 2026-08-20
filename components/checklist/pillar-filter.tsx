"use client";

import { PILLARS, PILLAR_ORDER, type ChecklistItem, type PillarId, type StatusMap } from "../../lib/checklist-data";
import { pillarCounts } from "../../lib/checklist-data";

// The cross-cutting filter.
//
// Stage stays the primary axis — the journey is the tool's whole argument — but a
// security reviewer should not have to walk four stages and 112 items to find the
// fifteen that are theirs. One row of chips, scoped to the stage on screen.
//
// The dangerous failure mode here is not a mis-tagged item, it is someone reading
// a filtered stage as a complete one and signing it. Three defences, all
// deliberate:
//
//  1. An active filter is loud — filled chip, and a banner stating exactly how
//     many items are hidden. Never a subtle highlight.
//  2. Gate state, progress and blocking counts are computed from every item
//     regardless of the filter. Filtering changes what you are reading, never
//     what the tool claims.
//  3. The PDF export ignores the filter completely. The artefact is always the
//     whole assessment, because a filtered evidence pack is a misleading one.
//
// The filter is also deliberately not persisted. A saved filter that silently
// hides items on the next page load is precisely the trap above, arriving without
// the click that would explain it.

export function PillarFilter({
  items,
  statuses,
  active,
  onChange,
}: {
  /** Items in scope — the current stage, not the whole checklist. */
  items: ChecklistItem[];
  statuses: StatusMap;
  active: PillarId | null;
  onChange: (pillar: PillarId | null) => void;
}) {
  const counts = pillarCounts(statuses, items);
  const hidden = active ? items.length - counts.find(c => c.pillar === active)!.matched : 0;

  return (
    <div className="mb-4">
      <div
        role="group"
        aria-label="Filter this stage by pillar"
        className="flex items-center gap-2 flex-wrap"
      >
        <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted mr-1">
          Pillar
        </span>

        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={active === null}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            active === null
              ? "border-ink bg-ink text-surface"
              : "border-line bg-surface text-ink-soft hover:border-line-strong"
          }`}
        >
          All {items.length}
        </button>

        {PILLAR_ORDER.map(pillar => {
          const c = counts.find(x => x.pillar === pillar)!;
          const isActive = active === pillar;
          return (
            <button
              key={pillar}
              type="button"
              onClick={() => onChange(isActive ? null : pillar)}
              aria-pressed={isActive}
              title={PILLARS[pillar].description}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                isActive
                  ? "border-brand-700 bg-brand-700 text-surface"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong"
              }`}
            >
              {PILLARS[pillar].short}{" "}
              <span className={`tabular-nums font-bold ${isActive ? "" : "text-ink-muted"}`}>
                {c.matched}
              </span>
              {c.outstandingBlockers > 0 && (
                <span
                  // Full-strength `text-surface` on the active chip, not an 80%
                  // tint: white at 80% over brand-700 falls to roughly 4:1, and
                  // this is 12px text carrying a blocking count.
                  className={`ml-1.5 tabular-nums ${isActive ? "text-surface" : "text-red-700"}`}
                  title={`${c.outstandingBlockers} blocking item${
                    c.outstandingBlockers === 1 ? "" : "s"
                  } outstanding in this pillar`}
                >
                  · {c.outstandingBlockers} blocking
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loud, not subtle. This banner is the thing standing between a filtered
          read and a false sign-off, and `role="status"` announces it to a screen
          reader when the filter changes. */}
      {active && (
        <div
          role="status"
          className="mt-3 flex items-start gap-3 rounded-card border border-amber-500 bg-amber-50 px-4 py-2.5"
        >
          <div className="flex-1 text-xs text-ink-soft leading-relaxed">
            <strong className="font-semibold text-ink">
              Filtered to {PILLARS[active].name} — {hidden} of this stage&apos;s {items.length} items are
              hidden.
            </strong>{" "}
            Gate state, progress and the PDF export all still cover every item. A filtered view is for
            reading, not for sign-off.
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-xs font-semibold text-brand-800 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}

/** The pillar badge shown on an item row. Primary is emphasised over secondary. */
export function PillarTag({ item }: { item: ChecklistItem }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
      <span title={PILLARS[item.pillar].description}>{PILLARS[item.pillar].short}</span>
      {item.pillar2 && (
        <span
          title={`Also relevant to ${PILLARS[item.pillar2].name}: ${PILLARS[item.pillar2].description}`}
          className="text-ink-faint"
        >
          + {PILLARS[item.pillar2].short}
        </span>
      )}
    </span>
  );
}
