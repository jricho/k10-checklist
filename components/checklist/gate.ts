// Gate presentation, shared by the sidebar, the stage header and the mobile nav.
//
// Extracted so the three places that render gate state cannot drift apart. The
// gate is the single most important signal in the app; three near-identical
// colour maps is exactly how one of them ends up a shade out or, worse, mapping
// `outstanding` to a reassuring colour.
//
// `amber-600` rather than `amber-500` for the fill: at #b8791a the amber
// measures 3.63:1 against white text, which fails AA. #92610a is 5.33:1. The
// most important status on the page is not the place to lose a contrast
// argument.

export const GATE = {
  clear: {
    badge: "bg-brand-700 text-white",
    dot: "bg-brand-500",
    short: "Gate clear",
    label: () => "GATE CLEAR",
  },
  outstanding: {
    badge: "bg-amber-600 text-white",
    dot: "bg-amber-500",
    short: "Blockers open",
    label: (n: number) => `${n} BLOCKING OPEN`,
  },
  blocked: {
    badge: "bg-red-600 text-white",
    dot: "bg-red-500",
    short: "Upstream blocked",
    label: () => "UPSTREAM BLOCKED",
  },
} as const;
