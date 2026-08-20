// The bridge between the checklist and the Kasten Maturity Model.
//
// This module deliberately does NOT score maturity. The companion workbook
// (Kasten Maturity Self-Assessment.xlsx) remains the authoritative instrument —
// scoring is a judgement about an organisation, and half of each dimension's
// descriptor is about process and people that no kubectl command can observe.
//
// What this does instead is report *evidence*: "the checklist verified every
// item this tool associates with Level 3 of Storage, Immutability & Security,
// and here are the two Level 4 items still outstanding." That output goes on a
// page of the exported PDF, where it is directly transcribable into the
// workbook's Current Level column — and, more usefully, tells the customer
// exactly which checklist items to close to justify the next level.
//
// The relationship is one-directional and evidential by design: the checklist
// feeds the workbook, the workbook is not recomputed from the checklist.

import {
  ALL_ITEMS,
  DIMENSION_ORDER,
  DIMENSIONS,
  statusOf,
  type ChecklistItem,
  type DimensionId,
  type MaturityLevel,
  type StatusMap,
} from "./checklist-data";

import type { RadarInput } from "./radar";

const LEVELS: MaturityLevel[] = [1, 2, 3, 4, 5];

/** Items tagged as evidence for a given dimension at a given level. */
export function itemsForSignal(dimension: DimensionId, level: MaturityLevel): ChecklistItem[] {
  return ALL_ITEMS.filter(i => i.signals.some(([d, l]) => d === dimension && l === level));
}

/** An item counts as satisfied when it passes, or when it has been ruled N/A. */
function satisfied(statuses: StatusMap, item: ChecklistItem): boolean {
  const s = statusOf(statuses, item.id);
  return s === "pass" || s === "na";
}

export interface DimensionEvidence {
  dimension: DimensionId;
  name: string;
  /**
   * Highest level for which every tagged item is satisfied, counting upward and
   * stopping at the first level with an outstanding item. 0 means no level's
   * evidence is complete yet.
   *
   * Contiguity matters: passing three Level 4 items while a Level 2 item is still
   * failing does not make an environment Level 4. The model is a ladder, and this
   * reports the highest rung with nothing missing below it.
   */
  evidencedLevel: number;
  /** The level this dimension is working toward — evidencedLevel + 1, capped at 5. */
  nextLevel: MaturityLevel | null;
  /** Outstanding items standing between evidencedLevel and nextLevel. */
  blockingNextLevel: ChecklistItem[];
  /** Every tagged item, with its status, for the detail table. */
  tagged: { item: ChecklistItem; level: MaturityLevel; satisfied: boolean }[];
  passedCount: number;
  taggedCount: number;
}

export function evidenceForDimension(dimension: DimensionId, statuses: StatusMap): DimensionEvidence {
  let evidencedLevel = 0;
  let blockingNextLevel: ChecklistItem[] = [];
  let nextLevel: MaturityLevel | null = null;

  for (const level of LEVELS) {
    const items = itemsForSignal(dimension, level);
    // No evidence is defined at this level for this dimension — the checklist
    // cannot speak to it, so pass over it rather than claiming or denying it.
    if (items.length === 0) continue;

    const outstanding = items.filter(i => !satisfied(statuses, i));
    if (outstanding.length === 0) {
      evidencedLevel = level;
      continue;
    }
    nextLevel = level;
    blockingNextLevel = outstanding;
    break;
  }

  const tagged = ALL_ITEMS.flatMap(item =>
    item.signals
      .filter(([d]) => d === dimension)
      .map(([, level]) => ({ item, level, satisfied: satisfied(statuses, item) })),
  ).sort((a, b) => a.level - b.level);

  return {
    dimension,
    name: DIMENSIONS[dimension].name,
    evidencedLevel,
    nextLevel,
    blockingNextLevel,
    tagged,
    passedCount: tagged.filter(t => t.satisfied).length,
    taggedCount: tagged.length,
  };
}

export function maturityEvidence(statuses: StatusMap): DimensionEvidence[] {
  return DIMENSION_ORDER.map(d => evidenceForDimension(d, statuses));
}

/**
 * The dimensions with the least evidence — where effort buys the largest single
 * reduction in risk. Mirrors the workbook's "prioritise the largest gap" advice,
 * except that here the gap is against evidence rather than against a target the
 * customer typed in.
 */
export function weakestDimensions(statuses: StatusMap, count = 3): DimensionEvidence[] {
  return [...maturityEvidence(statuses)]
    .sort((a, b) => a.evidencedLevel - b.evidencedLevel || b.blockingNextLevel.length - a.blockingNextLevel.length)
    .slice(0, count);
}

/**
 * Consequence of a dimension, as the number of blocking items tagged to it.
 *
 * `blocking` is used as the weight rather than a dedicated `weight` field on all
 * 112 items. Two reasons. It already exists and is already curated — 48 items
 * earned the flag through a deliberate pass, so it carries real editorial
 * judgement rather than a number invented per item in a second pass. And it
 * cannot drift out of step with the gates, which is the property that matters:
 * the dimensions the chart emphasises are exactly the ones that can stop a
 * sign-off.
 *
 * Weight never moves a gate and never moves a plotted level. It affects emphasis
 * only. See the note on `RadarInput.weight`.
 */
export function dimensionWeight(dimension: DimensionId): number {
  return ALL_ITEMS.filter(i => i.blocking && i.signals.some(([d]) => d === dimension)).length;
}

/**
 * The seven dimensions as radar input, in workbook row order.
 *
 * Values come straight from `evidencedLevel`, so the chart and the evidence list
 * beside it are computed once and cannot disagree.
 */
export function radarInputs(statuses: StatusMap): RadarInput[] {
  return maturityEvidence(statuses).map(ev => ({
    key: ev.dimension,
    label: DIMENSIONS[ev.dimension].axis,
    value: ev.evidencedLevel,
    weight: dimensionWeight(ev.dimension),
  }));
}

/** One-line summary for the PDF header and the UI banner. */
export function evidenceSummary(statuses: StatusMap): string {
  const ev = maturityEvidence(statuses);
  const scored = ev.filter(e => e.evidencedLevel > 0);
  if (scored.length === 0) return "No maturity evidence recorded yet";
  const avg = scored.reduce((n, e) => n + e.evidencedLevel, 0) / scored.length;
  const lowest = [...ev].sort((a, b) => a.evidencedLevel - b.evidencedLevel)[0];
  return `Evidence supports an average of L${avg.toFixed(1)} across ${scored.length}/7 dimensions — weakest: ${DIMENSIONS[lowest.dimension].short} (L${lowest.evidencedLevel})`;
}
