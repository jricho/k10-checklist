import type { StageId } from "./checklist-types";
import { STAGE_ORDER } from "./checklist-data";

// URL vocabulary, in one place.
//
// Stage ids and stage slugs are deliberately different strings. The ids are
// persisted inside every saved assessment and, like item ids, must never change
// — renaming `preprod` would orphan the `activeStage` of every saved file. The
// slugs are read by customers, appear in tickets and change-board links, and are
// spelled for them: `/assessment/pre-production`, not `/assessment/preprod`.
//
// Keeping the map here rather than deriving one from the other is what allows
// both to be true at once.

const STAGE_SLUG: Record<StageId, string> = {
  poc: "poc",
  preprod: "pre-production",
  golive: "go-live",
  day2: "day-2",
};

const STAGE_ID_BY_SLUG: Record<string, StageId> = Object.fromEntries(
  (Object.entries(STAGE_SLUG) as [StageId, string][]).map(([id, slug]) => [slug, id]),
);

export const STAGE_SLUGS: string[] = STAGE_ORDER.map(id => STAGE_SLUG[id]);

export function stageSlug(id: StageId): string {
  return STAGE_SLUG[id];
}

/** Null rather than a throw: an unknown slug is a 404, not a crash. */
export function stageIdFromSlug(slug: string): StageId | null {
  return STAGE_ID_BY_SLUG[slug] ?? null;
}

export function stageHref(id: StageId): string {
  return `/assessment/${STAGE_SLUG[id]}`;
}

export const ROUTES = {
  overview: "/",
  maturity: "/maturity",
  clusterCapture: "/cluster-capture",
} as const;
