"use client";

// Assessment state: shape, persistence, and import/export.
//
// Three problems this solves that the original single-component version had:
//
//  1. State was lost on refresh. A 90-item checklist is walked through over days,
//     in meetings, by more than one person. Losing it to an accidental reload is
//     the difference between a tool people use and a tool people abandon.
//
//  2. State was a boolean[][] keyed by array position, so inserting an item at
//     the top of a section silently shifted every saved answer down by one. Keying
//     on stable item ids makes the data survive edits to the checklist itself.
//
//  3. There was no way to hand an assessment to a colleague, diff it against last
//     quarter's, or commit it next to the cluster's IaC. A JSON export makes the
//     assessment a versionable artefact rather than a one-shot PDF.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemStatus, StageId } from "./checklist-types";
import type { StatusMap } from "./checklist-data";
import { defaultTiers, type WorkloadTier } from "./architecture";

/**
 * Bump when the persisted shape changes incompatibly; `migrate` handles the
 * upgrade. Note that STORAGE_KEY stays at v2 deliberately: v3 only *adds*
 * `tiers`, so an existing assessment can be read and upgraded in place rather
 * than being orphaned by a new key.
 */
export const ASSESSMENT_VERSION = 3;

const STORAGE_KEY = "k10-checklist:assessment:v2";

/** Free-text captures from the diagnostic commands. */
export type OutputKey = "primer" | "cluster" | "policies" | "popeye";

export interface AssessmentMeta {
  project: string;
  environment: string;
  clusterName: string;
  date: string;
  assessor: string;
  /**
   * Free-text context around the tier table — constraints, exclusions, who set
   * the targets. The per-tier RPO/RTO numbers themselves live in `tiers`, which
   * is what the DR items and the topology warnings read.
   */
  rtoRpoNotes: string;
  /** Named sign-offs, recorded as free text so the PDF can print them verbatim. */
  signoffPlatform: string;
  signoffSecurity: string;
  signoffWorkloadOwner: string;
}

export interface Assessment {
  version: number;
  meta: AssessmentMeta;
  /** Which stage the UI is showing. Persisted so a reload returns you to your place. */
  activeStage: StageId;
  /**
   * Workload tiers with their RPO/RTO targets and DR topology (Playbook §4.3,
   * §4.7). Seeded with the playbook's three tiers; renameable and extensible,
   * because "Production" means different things in different estates.
   */
  tiers: WorkloadTier[];
  statuses: StatusMap;
  /** Per-item free text — the finding, the accepted risk, the ticket reference. */
  notes: Record<string, string>;
  outputs: Record<OutputKey, string>;
  updatedAt: string;
}

export function emptyAssessment(): Assessment {
  return {
    version: ASSESSMENT_VERSION,
    meta: {
      project: "",
      environment: "",
      clusterName: "",
      date: new Date().toISOString().slice(0, 10),
      assessor: "",
      rtoRpoNotes: "",
      signoffPlatform: "",
      signoffSecurity: "",
      signoffWorkloadOwner: "",
    },
    activeStage: "poc",
    tiers: defaultTiers(),
    statuses: {},
    notes: {},
    outputs: { primer: "", cluster: "", policies: "", popeye: "" },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Tolerant of partial and older payloads: a hand-edited or previous-version file
 * should load with sensible defaults rather than throwing away the whole
 * assessment. Unknown item ids are kept — they cost nothing and mean an
 * assessment taken against a newer checklist can still be opened on an older
 * build without silently discarding answers.
 */
export function migrate(raw: unknown): Assessment {
  const base = emptyAssessment();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<Assessment>;
  return {
    ...base,
    ...input,
    version: ASSESSMENT_VERSION,
    meta: { ...base.meta, ...(input.meta ?? {}) },
    // A v2 assessment has no tiers, so seed them rather than rendering an empty
    // table. An explicitly emptied table is respected — only a missing key seeds.
    tiers: Array.isArray(input.tiers) ? input.tiers : base.tiers,
    statuses: { ...(input.statuses ?? {}) },
    notes: { ...(input.notes ?? {}) },
    outputs: { ...base.outputs, ...(input.outputs ?? {}) },
  };
}

/**
 * Persisted assessment state.
 *
 * Note what is *not* persisted: the uploaded architecture diagram. A PNG of a
 * real cluster is routinely several megabytes as a data URL, and localStorage
 * caps at around 5 MB — writing it there fails the whole save, taking the
 * checklist answers with it. The diagram stays in component state for the
 * session and is re-attached before export.
 */
export function useAssessment() {
  const [assessment, setAssessment] = useState<Assessment>(emptyAssessment);
  const [loaded, setLoaded] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);

  // Read once on mount rather than in the initialiser: this component renders on
  // the server first, where localStorage does not exist.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setAssessment(migrate(JSON.parse(stored)));
    } catch {
      // Corrupt or unreadable payload — start clean rather than trapping the user
      // on a broken page with no way to reset.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assessment));
      setPersistError(null);
    } catch (err) {
      setPersistError(
        err instanceof Error && err.name === "QuotaExceededError"
          ? "Browser storage is full — export to JSON to avoid losing this assessment."
          : "Could not save to browser storage — export to JSON to keep this assessment.",
      );
    }
  }, [assessment, loaded]);

  const setStatus = useCallback((id: string, status: ItemStatus) => {
    setAssessment(prev => ({
      ...prev,
      statuses: { ...prev.statuses, [id]: status },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  /** Click-through cycle: pending → pass → fail → N/A → pending. */
  const cycleStatus = useCallback((id: string) => {
    setAssessment(prev => {
      const order: ItemStatus[] = ["pending", "pass", "fail", "na"];
      const current = prev.statuses[id] ?? "pending";
      const next = order[(order.indexOf(current) + 1) % order.length];
      return {
        ...prev,
        statuses: { ...prev.statuses, [id]: next },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const setNote = useCallback((id: string, note: string) => {
    setAssessment(prev => ({ ...prev, notes: { ...prev.notes, [id]: note } }));
  }, []);

  const setMeta = useCallback(<K extends keyof AssessmentMeta>(key: K, value: AssessmentMeta[K]) => {
    setAssessment(prev => ({ ...prev, meta: { ...prev.meta, [key]: value } }));
  }, []);

  const setOutput = useCallback((key: OutputKey, value: string) => {
    setAssessment(prev => ({ ...prev, outputs: { ...prev.outputs, [key]: value } }));
  }, []);

  const setActiveStage = useCallback((stage: StageId) => {
    setAssessment(prev => ({ ...prev, activeStage: stage }));
  }, []);

  const updateTier = useCallback((id: string, patch: Partial<WorkloadTier>) => {
    setAssessment(prev => ({
      ...prev,
      tiers: prev.tiers.map(t => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const addTier = useCallback(() => {
    setAssessment(prev => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        {
          // Timestamped so it stays unique even if a tier is removed and another
          // added — ids are what the PDF and saved state key on.
          id: `tier-${Date.now().toString(36)}`,
          name: "",
          rpoTarget: "",
          rtoTarget: "",
          topology: "undecided",
          measuredRestore: "",
          notes: "",
        },
      ],
    }));
  }, []);

  const removeTier = useCallback((id: string) => {
    setAssessment(prev => ({ ...prev, tiers: prev.tiers.filter(t => t.id !== id) }));
  }, []);

  const reset = useCallback(() => setAssessment(emptyAssessment()), []);

  const load = useCallback((raw: unknown) => setAssessment(migrate(raw)), []);

  const exportJson = useCallback(() => JSON.stringify(assessment, null, 2), [assessment]);

  return useMemo(
    () => ({
      assessment,
      loaded,
      persistError,
      setStatus,
      cycleStatus,
      setNote,
      setMeta,
      setOutput,
      setActiveStage,
      updateTier,
      addTier,
      removeTier,
      reset,
      load,
      exportJson,
    }),
    [
      assessment,
      loaded,
      persistError,
      setStatus,
      cycleStatus,
      setNote,
      setMeta,
      setOutput,
      setActiveStage,
      updateTier,
      addTier,
      removeTier,
      reset,
      load,
      exportJson,
    ],
  );
}

export type AssessmentController = ReturnType<typeof useAssessment>;
