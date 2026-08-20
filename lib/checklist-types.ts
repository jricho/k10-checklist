// Types and vocabulary shared by the checklist data, the maturity
// cross-reference, and the PDF export.
//
// Everything here is deliberately free of React and of jsPDF so that the data
// module can be imported by a server component, a test, or a script.

/** The four stages of a customer's journey from evaluation to steady state. */
export type StageId = "poc" | "preprod" | "golive" | "day2";

/**
 * The seven dimensions of the Kasten Maturity Model (Resilience Playbook section 2.1).
 * Checklist items are tagged with the dimension(s) they provide evidence for so
 * the exported PDF can print "maturity signals observed" for transcription into
 * the companion self-assessment workbook.
 */
export type DimensionId =
  | "coverage"
  | "appconsistency"
  | "storage"
  | "central"
  | "dr"
  | "observability"
  | "people";

export type MaturityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * The four pillars of a resilient Kasten deployment, as named in the customer-
 * facing roadmap.
 *
 * These are a cross-cutting *filter*, not a third structure competing with the
 * other two. The rule, settled in CLAUDE.md and worth restating because the
 * three axes are easy to conflate:
 *
 *   stage is primary   — the journey is the point of the tool
 *   pillar is a filter — so a reviewer can see their remit without walking four
 *                        stages
 *   dimension is evidence — the maturity cross-reference, feeding the workbook
 *
 * Pillars deliberately overlap the seven maturity dimensions (Policy Automation
 * against Coverage & Policy Automation, for instance). They are not derived from
 * them, and this is the reason: a dimension answers "how mature is this
 * capability", a pillar answers "whose job is this". A platform engineer, a
 * security reviewer and a DR owner each want a different slice of the same 112
 * items, and none of those slices is a maturity question.
 *
 * Infrastructure Integrity carries the five items tagged `signals: []` — the
 * "the install actually works" checks that are prerequisites rather than
 * evidence of maturity. Under a dimension-derived filter those items would be
 * unreachable, which is the concrete argument for tagging by hand.
 */
export type PillarId = "infrastructure" | "policy" | "security" | "recovery";

export const PILLARS: Record<PillarId, { name: string; short: string; description: string }> = {
  infrastructure: {
    name: "Infrastructure Integrity",
    short: "Infrastructure",
    description:
      "The platform beneath the backups: supported versions, healthy components, sized capacity, reachable registries, working storage integration. Nothing else in this list is true if these are not.",
  },
  policy: {
    name: "Policy Automation",
    short: "Policy",
    description:
      "Protection that applies itself. Selector-driven policies, schedules that meet the stated RPO, retention that matches the obligation, and coverage that survives a new namespace appearing on a Friday.",
  },
  security: {
    name: "Security & RBAC",
    short: "Security",
    description:
      "Who can do what, and what an attacker cannot undo. Least-privilege access, immutable and locked storage, encryption and key custody, and an audit trail that shows the answer rather than asserting it.",
  },
  recovery: {
    name: "Disaster Recovery Validation",
    short: "Recovery",
    description:
      "Proof rather than intent. Restores actually performed, times actually measured against target, the Kasten catalog itself recoverable, and drills whose findings changed something.",
  },
};

/** Ordered for display: roughly the order a customer meets them. */
export const PILLAR_ORDER: PillarId[] = ["infrastructure", "policy", "security", "recovery"];

/**
 * A checklist item can be:
 *  - pending: not yet assessed (the default)
 *  - pass:    verified in this environment
 *  - fail:    assessed and found wanting — an explicit gap, not an omission
 *  - na:      does not apply here (single-cluster customer, no OpenShift, etc.)
 *
 * The distinction between `pending` and `na` is what makes the completion
 * percentage honest: N/A items leave the denominator, unassessed ones do not.
 */
export type ItemStatus = "pending" | "pass" | "fail" | "na";

/** [dimension, level] — "passing this item is evidence of level N in dimension X". */
export type MaturitySignal = [DimensionId, MaturityLevel];

export interface DocLink {
  label: string;
  url: string;
}

export interface ChecklistItem {
  /**
   * Stable, globally unique, kebab-case. Saved state is keyed on this, so an id
   * must never be reused for a different question — rename freely, but retire
   * ids rather than repurposing them.
   */
  id: string;
  label: string;
  /** Why this matters — the risk it retires. Written for a customer to read aloud. */
  why: string;
  /** What "pass" looks like in the command output, or what artefact to point at. */
  evidence: string;
  /** kubectl form. Omit for items evidenced by a document rather than a command. */
  cmd?: string;
  /** OpenShift form. Omit when it is just kubectl→oc (derived automatically). */
  oc?: string;
  /** Blocking items gate the stage: the stage cannot be signed off until they pass. */
  blocking?: boolean;
  /** Commonly-N/A items (multi-cluster, KubeVirt, air-gap). Surfaces an N/A hint in the UI. */
  conditional?: boolean;
  /**
   * Owning pillar. Required, and exactly one — so the four pillar counts
   * partition the 112 items and a reader can trust that the four numbers add up.
   */
  pillar: PillarId;
  /**
   * Second pillar, where the item genuinely serves two audiences.
   *
   * The filter matches on either, because the cost of the two errors is not
   * symmetric: a security reviewer who never sees `restore-from-export` because
   * its primary pillar is Recovery has missed something, whereas one who sees an
   * item of marginal relevance has merely read an extra line. Kept optional and
   * used sparingly — if most items carried two, the filter would stop narrowing
   * anything.
   */
  pillar2?: PillarId;
  signals: MaturitySignal[];
  docs?: DocLink[];
}

export interface ChecklistSection {
  id: string;
  title: string;
  intro?: string;
  items: ChecklistItem[];
}

export interface Stage {
  id: StageId;
  /** Short name for the tab. */
  name: string;
  /** One line under the tab. */
  strapline: string;
  /** Corresponding phase of the 100-day roadmap, for traceability. */
  roadmapPhase: string;
  /**
   * Sections of the Kasten Resilience Playbook that this stage draws on.
   *
   * Provenance, not decoration: a customer who asks "where does this item come
   * from" should be one click from the paragraph it came from, and a reviewer
   * should be able to check the stage against its source. The playbook ships at
   * public/kasten-resilience-playbook.pdf so the link resolves in a self-hosted
   * or air-gapped deployment.
   */
  playbookRefs?: string[];
  /** The single question this stage answers. */
  goal: string;
  /** Human-readable gate. Rendered next to the stage's blocking-item count. */
  exitCriteria: string[];
  /** Typical maturity level a customer sits at once the stage is cleared. */
  maturityTarget: string;
  sections: ChecklistSection[];
}

/**
 * `axis` is a third, shorter form used only on the radar.
 *
 * Not redundancy. `short` is free to run to two words because it sits in a
 * flowing row of item metadata, whereas an axis label has a fixed geometric
 * budget: it is anchored at a computed point outside the outer ring, and a label
 * wider than that budget either overflows the chart or forces the plot to shrink
 * until the rings are unreadable. "Storage & security" at 10.5px is 95px wide,
 * which is most of the horizontal space available on a side axis.
 */
export const DIMENSIONS: Record<DimensionId, { name: string; short: string; axis: string }> = {
  coverage: { name: "Coverage & Policy Automation", short: "Coverage", axis: "Coverage" },
  appconsistency: { name: "Application Consistency", short: "App consistency", axis: "Consistency" },
  storage: { name: "Storage, Immutability & Security", short: "Storage & security", axis: "Storage" },
  central: {
    name: "Centralized Management & Multi-Cluster",
    short: "Centralized mgmt",
    axis: "Multi-cluster",
  },
  dr: { name: "Disaster Recovery", short: "DR", axis: "DR" },
  observability: {
    name: "Observability, Compliance & Reporting",
    short: "Observability",
    axis: "Observability",
  },
  people: { name: "People, Process & Continuous Validation", short: "People & process", axis: "People" },
};

/** Ordered for display — matches the order of rows in the self-assessment workbook. */
export const DIMENSION_ORDER: DimensionId[] = [
  "coverage",
  "appconsistency",
  "storage",
  "central",
  "dr",
  "observability",
  "people",
];

export const STAGE_ORDER: StageId[] = ["poc", "preprod", "golive", "day2"];

/**
 * OpenShift command for an item. Most differ from kubectl only in the binary
 * name, so we derive rather than duplicating ~80 strings; items where the
 * OpenShift path genuinely differs (routes, `oc adm top`, SCCs) set `oc`.
 */
export function ocCommandFor(item: ChecklistItem): string | undefined {
  if (item.oc) return item.oc;
  if (!item.cmd) return undefined;
  return item.cmd.replace(/\bkubectl\b/g, "oc");
}
