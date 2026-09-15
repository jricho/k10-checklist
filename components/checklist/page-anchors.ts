// The page-level panels that sit below the stage checklist.
//
// These are deliberately kept out of the Sections jump list. That list is
// stage-scoped — it rebuilds whenever the active stage changes — whereas the
// tiers table and the maturity panel are computed from the whole assessment and
// stay put. Mixing them in would imply the maturity readout belongs to Stage 3,
// which is exactly the misreading the panel exists to prevent.
//
// Both navigations read this list: the sidebar rail from `lg` up, and StageNav
// below it. A new panel added here gets an entry in both places, or in neither —
// the previous arrangement, where the architecture panel had an anchor and no
// nav entry and the maturity panel had neither, is how a panel ends up reachable
// only by scrolling.
export const PAGE_ANCHORS = [
  { id: "architecture", label: "Workload tiers & DR topology", short: "Tiers & DR" },
  { id: "maturity", label: "Maturity signals", short: "Maturity" },
] as const;
