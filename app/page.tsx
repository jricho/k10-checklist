"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { StageNav, StageHeader } from "../components/checklist/stage-nav";
import { Sidebar } from "../components/checklist/sidebar";
import { SectionCard } from "../components/checklist/section-card";
import { MaturityPanel } from "../components/checklist/maturity-panel";
import { ArchitecturePanel } from "../components/checklist/architecture-panel";
import { DiagnosticsCard } from "../components/checklist/diagnostics-card";
import { useAssessment } from "../lib/checklist-state";
import {
  downloadJson,
  exportAssessmentPdf,
  EXPORT_SCOPE_LABELS,
  type ExportScope,
} from "../lib/export-pdf";
import { STAGES_BY_ID, overallProgress } from "../lib/checklist-data";
import { DownloadIcon, ExternalLinkIcon } from "../components/ui/icon";

// The page is now composition only: state comes from `useAssessment`, structure
// from `lib/checklist-data`, output from `lib/export-pdf`. The original version
// held the checklist data, all the UI, and 120 lines of PDF layout in one 1,000-
// line client component, which meant adding a checklist item required editing the
// same file as the PDF page-break arithmetic.

type DiagramState = { dataUrl: string; name: string; dims: { w: number; h: number } } | null;

export default function ChecklistPage() {
  const ctrl = useAssessment();
  const { assessment, setMeta, setStatus, setNote, setOutput, setActiveStage } = ctrl;
  const { meta, statuses, notes, outputs, activeStage } = assessment;

  const [diagram, setDiagram] = useState<DiagramState>(null);
  const [exporting, setExporting] = useState(false);
  // Defaults to the stage being viewed plus everything before it: a gate's
  // sign-off needs the upstream evidence, but not the stages still ahead.
  const [exportScope, setExportScope] = useState<ExportScope>("through");
  const [showTools, setShowTools] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const stage = STAGES_BY_ID[activeStage];
  const overall = overallProgress(statuses);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportAssessmentPdf({ assessment, diagram, scope: exportScope });
    } finally {
      setExporting(false);
    }
  };

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

  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        ctrl.load(JSON.parse(String(reader.result ?? "{}")));
      } catch {
        window.alert("That file could not be read as a saved assessment.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b border-line shadow-sm sticky top-0 z-20">
        <div className="max-w-[86rem] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Image
              src="/veeam_logo.svg"
              alt="Veeam"
              width={140}
              height={36}
              className="h-8 w-auto"
              unoptimized
              priority
            />
            <div className="hidden sm:block h-7 w-px bg-line-strong" />
            <span className="hidden sm:block text-xs font-medium text-ink-muted tracking-wide uppercase truncate">
              Readiness & Operating Maturity
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:block text-xs text-ink-muted tabular-nums mr-1">
              {overall.passed}/{overall.applicable} overall
            </span>
            <input ref={fileInput} type="file" accept=".json" className="hidden" onChange={handleLoadJson} />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="text-xs font-semibold text-ink-soft hover:text-brand-700 px-2 py-2"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() =>
                downloadJson(
                  `kasten-assessment-${meta.project ? meta.project.replace(/\s+/g, "-").toLowerCase() + "-" : ""}${meta.date}.json`,
                  ctrl.exportJson(),
                )
              }
              className="text-xs font-semibold text-ink-soft hover:text-brand-700 px-2 py-2"
            >
              Save
            </button>
            <label htmlFor="export-scope" className="sr-only">
              PDF export scope
            </label>
            <select
              id="export-scope"
              value={exportScope}
              onChange={e => setExportScope(e.target.value as ExportScope)}
              title="How much of the journey the exported PDF covers"
              className="text-xs font-medium text-ink-soft border border-line-strong rounded-lg px-2 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              {(Object.keys(EXPORT_SCOPE_LABELS) as ExportScope[]).map(key => (
                <option key={key} value={key}>
                  {EXPORT_SCOPE_LABELS[key]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex items-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                />
              </svg>
              {exporting ? "Building…" : "Export PDF"}
            </button>
          </div>
        </div>
      </header>

      {/* One staggered reveal on load, applied to the five top-level regions
          only — see globals.css. Per-item animation across 112 rows would read
          as jitter, and anything that animates after load (expanding a section,
          flipping a status) is deliberately instant: in an instrument, animated
          feedback reads as latency. `--reveal-index` sets the cascade. */}
      <main className="max-w-[86rem] mx-auto px-6 py-7">
        <div className="mb-6 reveal" style={{ "--reveal-index": 0 } as React.CSSProperties}>
          <h1 className="font-display text-2xl font-bold text-ink mb-2">
            Veeam Kasten readiness, from proof of concept to operating maturity
          </h1>
          <p className="text-ink-muted text-sm max-w-3xl leading-relaxed">
            Four stages, each with its own gate. Work through them in order: prove recovery works, make protection
            automatic and immutable, make failure visible and recovery executable, then sustain it. Export the PDF at
            each gate for the change record, and carry the maturity signals into the self-assessment workbook.
          </p>
          {/* Both files ship in public/ so the links resolve in a self-hosted or
              air-gapped deployment rather than pointing at an intranet. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Reference</span>
            <a
              href="/kasten-resilience-playbook.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              The Kasten Resilience Playbook (PDF) <ExternalLinkIcon />
            </a>
            <a
              href="/kasten-maturity-self-assessment.xlsx"
              download
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Maturity Self-Assessment workbook (XLSX) <DownloadIcon />
            </a>
          </div>
        </div>

        {ctrl.persistError && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"
          >
            {ctrl.persistError}
          </div>
        )}

        {/* Engagement details */}
        <div
          className="bg-surface rounded-card border border-line shadow-card p-5 mb-5 reveal"
          style={{ "--reveal-index": 1 } as React.CSSProperties}
        >
          <h2 className="text-xs font-semibold text-ink-muted mb-4 uppercase tracking-wide">Assessment details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Field label="Project" value={meta.project} onChange={v => setMeta("project", v)} placeholder="Customer or project name" />
            <Field label="Environment" value={meta.environment} onChange={v => setMeta("environment", v)} placeholder="e.g. Production, Staging" />
            <Field label="Cluster" value={meta.clusterName} onChange={v => setMeta("clusterName", v)} placeholder="Cluster name or context" />
            <Field label="Assessor" value={meta.assessor} onChange={v => setMeta("assessor", v)} placeholder="Who performed this" />
            <Field label="Date" value={meta.date} onChange={v => setMeta("date", v)} type="date" />
          </div>
          {/* RPO/RTO used to be a textarea here. It now lives in the tiers table
              in the architecture panel, because a textarea cannot tell you that
              a two-hour RTO and an export-only topology are incompatible. */}
          <p className="text-[13px] text-ink-muted">
            RPO and RTO targets are recorded per workload tier in{" "}
            <a href="#architecture" className="font-medium text-brand-700 hover:underline">
              Workload tiers &amp; DR topology
            </a>{" "}
            below. Every disaster recovery item is assessed against them.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-line">
            <Field label="Sign-off — Platform" value={meta.signoffPlatform} onChange={v => setMeta("signoffPlatform", v)} placeholder="Name & date" />
            <Field label="Sign-off — Security / Compliance" value={meta.signoffSecurity} onChange={v => setMeta("signoffSecurity", v)} placeholder="Name & date" />
            <Field label="Sign-off — Workload owner" value={meta.signoffWorkloadOwner} onChange={v => setMeta("signoffWorkloadOwner", v)} placeholder="Name & date" />
          </div>
        </div>

        {/* Two columns from `lg` up: sticky rail plus content. Below that the
            rail is hidden and StageNav supplies navigation inline. */}
        <div className="flex gap-6 items-start">
          <Sidebar activeStage={activeStage} statuses={statuses} onSelect={setActiveStage} />

          <div className="flex-1 min-w-0">
            <div className="reveal" style={{ "--reveal-index": 2 } as React.CSSProperties}>
              <StageNav active={activeStage} statuses={statuses} onSelect={setActiveStage} />
              <StageHeader stageId={activeStage} statuses={statuses} />
            </div>

        <div className="space-y-5 reveal" style={{ "--reveal-index": 3 } as React.CSSProperties}>
          {stage.sections.map(section => (
            <SectionCard
              key={section.id}
              section={section}
              statuses={statuses}
              notes={notes}
              onStatus={setStatus}
              onNote={setNote}
            />
          ))}
        </div>

        <div className="mt-8 space-y-6 reveal" style={{ "--reveal-index": 4 } as React.CSSProperties}>
          <div id="architecture" className="scroll-mt-20">
            <ArchitecturePanel
              tiers={assessment.tiers}
              notes={meta.rtoRpoNotes}
              onTierChange={ctrl.updateTier}
              onAddTier={ctrl.addTier}
              onRemoveTier={ctrl.removeTier}
              onNotesChange={v => setMeta("rtoRpoNotes", v)}
            />
          </div>

          <MaturityPanel statuses={statuses} />

          <div>
            <button
              type="button"
              onClick={() => setShowTools(v => !v)}
              aria-expanded={showTools}
              className="text-sm font-semibold text-brand-700 hover:underline mb-3"
            >
              {showTools ? "Hide" : "Show"} diagnostic captures & architecture diagram
            </button>
            {showTools && (
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
                    assessment itself.
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
            )}
            </div>
          </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-line bg-surface">
        <div className="max-w-[86rem] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-ink-faint">
            &copy; {new Date().getFullYear()} Veeam Software. Assessment data stays in your browser — this app has no
            backend and no cluster access.
          </span>
          <span className="flex items-center gap-4">
            {/* Temporary while the four-stage version is under review — remove
                this link and app/legacy/ once it is signed off. */}
            <Link href="/legacy" className="text-xs text-ink-faint hover:text-ink-soft hover:underline">
              Previous version
            </Link>
            <a
              href="https://docs.kasten.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-700 hover:underline"
            >
              docs.kasten.io
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
      />
    </div>
  );
}
