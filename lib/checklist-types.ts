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

export const DIMENSIONS: Record<DimensionId, { name: string; short: string }> = {
  coverage: { name: "Coverage & Policy Automation", short: "Coverage" },
  appconsistency: { name: "Application Consistency", short: "App consistency" },
  storage: { name: "Storage, Immutability & Security", short: "Storage & security" },
  central: { name: "Centralized Management & Multi-Cluster", short: "Centralized mgmt" },
  dr: { name: "Disaster Recovery", short: "DR" },
  observability: { name: "Observability, Compliance & Reporting", short: "Observability" },
  people: { name: "People, Process & Continuous Validation", short: "People & process" },
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
