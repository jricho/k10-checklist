"use client";

import React from "react";
import Link from "next/link";
import { DiagnosticsCard } from "../../../components/checklist/diagnostics-card";
import { useAssessmentContext } from "../../../components/checklist/assessment-provider";
import { ExternalLinkIcon } from "../../../components/ui/icon";

// Cluster capture: the read-only commands and the architecture diagram.
//
// Named for what it does rather than for what it looked like. "Diagnostics"
// implied fault-finding; nothing here diagnoses anything. It records what the
// cluster looks like so the pack shows observed state, not only ticked boxes.
//
// Previously a "Show diagnostic captures & architecture diagram" toggle at the
// foot of the checklist, collapsed by default — which meant the commands people
// are meant to run against the cluster were the one part of the tool you had to
// know was there. On its own route they are a place you can be sent to, and a
// link you can paste into a ticket.
//
// The diagram is still held in memory for the session only; it lives in the
// provider rather than in this component so that navigating back to the
// checklist and exporting does not lose it.

export default function DiagnosticsPage() {
  const { ctrl, diagram, setDiagram } = useAssessmentContext();
  const { outputs } = ctrl.assessment;
  const { setOutput } = ctrl;

  const handleDiagramUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const img = new window.Image();
      img.onload = () =>
        setDiagram({ dataUrl, name: file.name, dims: { w: img.naturalWidth, h: img.naturalHeight } });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="max-w-[86rem] mx-auto px-6 py-7">
      <header className="mb-6">
        <p className="font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-ink-muted mb-2">
          Veeam Kasten · Evidence capture
        </p>
        <h1 className="font-display text-2xl font-bold text-ink mb-3">Cluster capture</h1>
        <p className="text-base text-ink-soft max-w-[70ch] leading-relaxed">
          Run these against the cluster and paste the output back. The captures are saved with the assessment
          and reproduced in the PDF export, so the record shows what was observed rather than only what was
          ticked.
        </p>
        <Link href="/" className="inline-block mt-4 text-xs font-semibold text-brand-700 hover:underline">
          ← Back to the checklist
        </Link>
      </header>

      <div className="space-y-6">
        <DiagnosticsCard outputs={outputs} onChange={setOutput} />

        <section className="bg-surface rounded-card border border-line shadow-card p-5">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h2 className="text-base font-semibold text-ink">Cluster architecture diagram</h2>
            <a
              href="https://github.com/philippemerle/KubeDiagrams"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-brand-700 hover:underline shrink-0"
            >
              KubeDiagrams <ExternalLinkIcon />
            </a>
          </div>
          <p className="text-[13px] text-ink-muted mb-4 leading-relaxed">
            Optional. Generate one with{" "}
            <code className="text-[12px] bg-surface-sunken rounded px-1">
              kubectl get all -A -o yaml | kube-diagrams -o k10-arch.png -
            </code>{" "}
            and attach it here; it is embedded on its own page in the export. Held in memory for this session
            only — a multi-megabyte image cannot be persisted to browser storage without evicting the
            assessment itself. It survives moving between these views, but not a reload.
          </p>
          {!diagram ? (
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-line-strong rounded-lg px-6 py-8 cursor-pointer hover:border-brand-600 hover:bg-surface-sunken/60 transition-colors">
              <span className="text-sm font-medium text-ink-soft">Click to upload diagram</span>
              <span className="text-xs text-ink-faint mt-1">PNG or JPEG</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleDiagramUpload}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-surface-sunken border border-line rounded-lg px-4 py-2">
                <span className="text-sm text-ink-soft truncate">
                  {diagram.name}{" "}
                  <span className="text-xs text-ink-faint">
                    ({diagram.dims.w}×{diagram.dims.h})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setDiagram(null)}
                  className="text-xs font-medium text-red-600 hover:underline shrink-0 ml-3"
                >
                  Remove
                </button>
              </div>
              <div className="border border-line rounded-lg bg-surface-sunken flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={diagram.dataUrl}
                  alt="Cluster architecture diagram preview"
                  className="max-h-72 w-auto object-contain"
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
