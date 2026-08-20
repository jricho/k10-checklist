import type { ChecklistItem, ItemStatus, Stage, StageId } from "./checklist-types";
import { STAGE_ORDER } from "./checklist-types";
import { POC_STAGE } from "./stages/poc";
import { PREPROD_STAGE } from "./stages/preprod";
import { GOLIVE_STAGE } from "./stages/golive";
import { DAY2_STAGE } from "./stages/day2";

export * from "./checklist-types";

/** The four stages, in journey order. */
export const STAGES: Stage[] = [POC_STAGE, PREPROD_STAGE, GOLIVE_STAGE, DAY2_STAGE];

export const STAGES_BY_ID: Record<StageId, Stage> = {
  poc: POC_STAGE,
  preprod: PREPROD_STAGE,
  golive: GOLIVE_STAGE,
  day2: DAY2_STAGE,
};

/** Every item, flattened, in journey order. */
export const ALL_ITEMS: ChecklistItem[] = STAGES.flatMap(s => s.sections.flatMap(sec => sec.items));

/** id -> item, for resolving saved state. */
export const ITEMS_BY_ID: Record<string, ChecklistItem> = Object.fromEntries(
  ALL_ITEMS.map(i => [i.id, i]),
);

/** id -> stage, so a saved answer can be attributed without a nested search. */
export const STAGE_OF_ITEM: Record<string, StageId> = Object.fromEntries(
  STAGES.flatMap(s => s.sections.flatMap(sec => sec.items.map(i => [i.id, s.id] as const))),
);

export function itemsForStage(stageId: StageId): ChecklistItem[] {
  return STAGES_BY_ID[stageId].sections.flatMap(sec => sec.items);
}

/** Stages at or before `stageId` — a stage's gate includes everything upstream of it. */
export function stagesUpTo(stageId: StageId): Stage[] {
  const idx = STAGE_ORDER.indexOf(stageId);
  return STAGES.filter(s => STAGE_ORDER.indexOf(s.id) <= idx);
}

export type StatusMap = Record<string, ItemStatus>;

export function statusOf(statuses: StatusMap, id: string): ItemStatus {
  return statuses[id] ?? "pending";
}

export interface StageProgress {
  stageId: StageId;
  /** Items that count toward completion (N/A excluded). */
  applicable: number;
  passed: number;
  failed: number;
  pending: number;
  na: number;
  percent: number;
  /** Blocking items in this stage that are not yet passing. */
  blockersOutstanding: ChecklistItem[];
  /** Blocking items in *earlier* stages that are not yet passing. */
  upstreamBlockers: ChecklistItem[];
  /**
   * Gate state:
   *  - "clear"      every blocking item in this stage and all earlier stages passes
   *  - "blocked"    an earlier stage still has an outstanding blocking item
   *  - "outstanding" this stage has outstanding blocking items of its own
   */
  gate: "clear" | "blocked" | "outstanding";
}

/**
 * Progress and gate state for one stage.
 *
 * The gate is deliberately not a percentage. An 80%-complete readiness checklist
 * that happens to be missing "restore proven from an exported restore point" is
 * not 80% ready — it is not ready, and a RAG light driven by a completion ratio
 * says GO in exactly that situation. Blocking items are all-or-nothing; the
 * percentage is progress reporting only.
 *
 * A blocking item marked N/A is treated as satisfied: that is what N/A means, and
 * it is why marking something N/A should be a deliberate, recorded decision.
 */
export function progressForStage(stageId: StageId, statuses: StatusMap): StageProgress {
  const items = itemsForStage(stageId);
  let passed = 0;
  let failed = 0;
  let pending = 0;
  let na = 0;

  for (const item of items) {
    switch (statusOf(statuses, item.id)) {
      case "pass":
        passed++;
        break;
      case "fail":
        failed++;
        break;
      case "na":
        na++;
        break;
      default:
        pending++;
    }
  }

  const applicable = items.length - na;
  const percent = applicable === 0 ? 100 : Math.round((passed / applicable) * 100);

  const outstanding = (list: ChecklistItem[]) =>
    list.filter(i => {
      if (!i.blocking) return false;
      const s = statusOf(statuses, i.id);
      return s !== "pass" && s !== "na";
    });

  const blockersOutstanding = outstanding(items);
  const upstreamBlockers = outstanding(
    stagesUpTo(stageId)
      .filter(s => s.id !== stageId)
      .flatMap(s => s.sections.flatMap(sec => sec.items)),
  );

  const gate: StageProgress["gate"] =
    upstreamBlockers.length > 0 ? "blocked" : blockersOutstanding.length > 0 ? "outstanding" : "clear";

  return {
    stageId,
    applicable,
    passed,
    failed,
    pending,
    na,
    percent,
    blockersOutstanding,
    upstreamBlockers,
    gate,
  };
}

export function overallProgress(statuses: StatusMap) {
  const perStage = STAGE_ORDER.map(id => progressForStage(id, statuses));
  const applicable = perStage.reduce((n, p) => n + p.applicable, 0);
  const passed = perStage.reduce((n, p) => n + p.passed, 0);
  return {
    perStage,
    applicable,
    passed,
    percent: applicable === 0 ? 0 : Math.round((passed / applicable) * 100),
    /** The furthest stage whose gate is clear — the customer's position on the journey. */
    stageReached:
      [...perStage].reverse().find(p => p.gate === "clear")?.stageId ?? null,
  };
}

/**
 * Data invariants, checked in development only.
 *
 * The whole design rests on ids being unique and stable — saved state, PDF
 * output and maturity aggregation are all keyed on them. A duplicated id would
 * make two questions share one answer, which is the kind of bug that survives
 * review because everything still renders. Failing loudly at import time in dev
 * costs nothing and needs no test runner.
 */
export function validateChecklistData(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const stage of STAGES) {
    for (const section of stage.sections) {
      if (section.items.length === 0) problems.push(`Section ${section.id} has no items`);
      for (const item of section.items) {
        if (seen.has(item.id)) problems.push(`Duplicate item id: ${item.id}`);
        seen.add(item.id);
        if (!/^[a-z0-9-]+$/.test(item.id)) problems.push(`Item id not kebab-case: ${item.id}`);
        if (!item.why?.trim()) problems.push(`Item ${item.id} has no 'why'`);
        if (!item.evidence?.trim()) problems.push(`Item ${item.id} has no 'evidence'`);
        for (const [dim, level] of item.signals) {
          if (level < 1 || level > 5) problems.push(`Item ${item.id} has out-of-range level for ${dim}`);
        }
      }
    }
  }
  return problems;
}

if (process.env.NODE_ENV !== "production") {
  const problems = validateChecklistData();
  if (problems.length > 0) {
    console.error("[checklist-data] invariant violations:\n  " + problems.join("\n  "));
  }
}
