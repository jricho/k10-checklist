"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { useAssessment, type AssessmentController } from "../../lib/checklist-state";

// Why the assessment moved into a provider rather than staying in the page.
//
// `useAssessment` persists to localStorage, so two pages each calling it would
// eventually agree on the checklist answers. The uploaded architecture diagram
// would not. It is deliberately session-only — a multi-megabyte data URL cannot
// go into localStorage without evicting the assessment itself, see the note on
// `useAssessment` — so it lives only in React state.
//
// That is what forces the provider. Once the diagram uploader moved to
// /diagnostics while Export PDF stayed in the header, component-local state
// would mean attaching a diagram on one route and exporting from another
// silently dropped it, with no error and no clue. Hoisting both the controller
// and the diagram above the routes is what makes the split safe.
//
// One instance only: `useAssessment` owns a write-back effect, so mounting it
// twice would give two writers for one storage key.

export type DiagramState = {
  dataUrl: string;
  name: string;
  dims: { w: number; h: number };
} | null;

interface AssessmentContextValue {
  ctrl: AssessmentController;
  diagram: DiagramState;
  setDiagram: React.Dispatch<React.SetStateAction<DiagramState>>;
}

const AssessmentContext = createContext<AssessmentContextValue | null>(null);

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const ctrl = useAssessment();
  const [diagram, setDiagram] = useState<DiagramState>(null);

  const value = useMemo(() => ({ ctrl, diagram, setDiagram }), [ctrl, diagram]);

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}

/**
 * Throws rather than returning null when used outside the provider: a route
 * rendered outside the group would otherwise fail later and less legibly, as a
 * property access on undefined somewhere in the tree.
 */
export function useAssessmentContext(): AssessmentContextValue {
  const ctx = useContext(AssessmentContext);
  if (!ctx) {
    throw new Error(
      "useAssessmentContext must be called inside <AssessmentProvider> — see app/(assessment)/layout.tsx",
    );
  }
  return ctx;
}
