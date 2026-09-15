"use client";

import React, { useState } from "react";
import { StageNav, StageHeader } from "../../components/checklist/stage-nav";
import { Sidebar } from "../../components/checklist/sidebar";
import { SectionCard } from "../../components/checklist/section-card";
import { PillarFilter } from "../../components/checklist/pillar-filter";
import { MaturitySummary } from "../../components/checklist/maturity-summary";
import { ArchitecturePanel } from "../../components/checklist/architecture-panel";
import { useAssessmentContext } from "../../components/checklist/assessment-provider";
import { STAGES, STAGES_BY_ID, itemsForStage, type PillarId } from "../../lib/checklist-data";
import {
  ChevronRightIcon,
  DocumentIcon,
  DownloadIcon,
  ExternalLinkIcon,
  SpreadsheetIcon,
} from "../../components/ui/icon";

// The page is composition only: state comes from the provider, structure from
// `lib/checklist-data`, output from `lib/export-pdf`. The original version held
// the checklist data, all the UI, and 120 lines of PDF layout in one 1,000-line
// client component, which meant adding a checklist item required editing the
// same file as the PDF page-break arithmetic.
//
// Chrome — masthead bar, route tabs, Ask, Export, footer — now lives in
// AppChrome, shared with /maturity and /diagnostics. What remains here is the
// checklist itself plus the two panels that belong beside it: the tier table,
// which the DR items are assessed against, and the maturity summary.

export default function ChecklistPage() {
  const { ctrl } = useAssessmentContext();
  const { assessment, setMeta, setStatus, setNote, setActiveStage } = ctrl;
  const { meta, statuses, notes, activeStage } = assessment;

  // Deliberately component state, not persisted. A filter restored on load would
  // hide items without the click that explains why — see pillar-filter.tsx.
  const [pillar, setPillar] = useState<PillarId | null>(null);

  const stage = STAGES_BY_ID[activeStage];

  return (
    <>
      {/* One staggered reveal on load, applied to the top-level regions only —
          see globals.css. Per-item animation across 112 rows would read as
          jitter, and anything that animates after load (expanding a section,
          flipping a status) is deliberately instant: in an instrument, animated
          feedback reads as latency. `--reveal-index` sets the cascade. */}
      <main className="max-w-[86rem] mx-auto px-6 py-7">
        {/* Masthead.
            The previous version read as four clipped imperatives — "Prove that
            recovery works. Make protection automatic…" — which is manifesto
            register, not the register of an artefact somebody signs. It was also
            doing the stage headers' job: explaining the method rather than
            identifying the document.

            So: an eyebrow that says what this is, a title, one measured sentence
            of scope, and the stage sequence as a named progression rather than a
            chain of instructions. The method belongs in each stage header, where
            it already lives alongside that stage's exit criteria. */}
        <header className="mb-6 reveal" style={{ "--reveal-index": "0" } as React.CSSProperties}>
          <p className="font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-ink-muted mb-2">
            Veeam Kasten · Readiness assessment
          </p>
          {/* Title row carries the reference documents.
              They were a labelled link row below the standfirst, which read as a
              third block of text in a masthead that only needed two. As bordered
              icon affordances on the title's baseline they occupy the empty space
              to the right of a short title, and they read as apparatus —
              something you reach for — rather than as more prose. */}
          <div className="flex flex-wrap items-start justify-between gap-6 mb-3">
            <h1 className="font-display text-2xl font-bold text-ink max-w-[24ch] sm:max-w-none">
              Readiness and operating maturity
            </h1>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {/* Icon-only, so each needs an accessible name and a tooltip: the
                  glyph alone never conveys which document it opens. */}
              <a
                href="/kasten-resilience-playbook.pdf"
                target="_blank"
                rel="noopener noreferrer"
                title="The Kasten Resilience Playbook (PDF) — opens in a new tab"
                aria-label="Open The Kasten Resilience Playbook, PDF, in a new tab"
                className="group flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink-muted transition-colors hover:border-brand-600 hover:text-brand-700 hover:bg-brand-50"
              >
                <DocumentIcon className="h-7 w-7" />
                <span className="hidden xl:inline text-sm font-semibold">Playbook</span>
                <ExternalLinkIcon className="text-ink-faint group-hover:text-brand-700" />
              </a>
              <a
                href="/kasten-maturity-self-assessment.xlsx"
                download
                title="Maturity Self-Assessment workbook (XLSX) — downloads"
                aria-label="Download the Maturity Self-Assessment workbook, XLSX"
                className="group flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink-muted transition-colors hover:border-brand-600 hover:text-brand-700 hover:bg-brand-50"
              >
                <SpreadsheetIcon className="h-7 w-7" />
                <span className="hidden xl:inline text-sm font-semibold">Workbook</span>
                <DownloadIcon className="text-ink-faint group-hover:text-brand-700" />
              </a>
            </div>
          </div>
          <p className="text-base text-ink-soft max-w-[70ch] leading-relaxed">
            A staged verification of a Veeam Kasten deployment — from proof of concept, through production readiness,
            to day-2 operating maturity — evidenced against a live cluster and exported as a signable record.
          </p>

          {/* The four stages as a progression, generated from the data so the
              masthead cannot drift from the stages themselves. Names only: the
              sidebar carries the counts and each stage header carries its goal,
              so repeating either here would be noise. */}
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 mt-4">
            {STAGES.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2">
                {i > 0 && <ChevronRightIcon className="text-line-strong" />}
                <button
                  type="button"
                  onClick={() => setActiveStage(s.id)}
                  className={`inline-flex items-baseline gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    s.id === activeStage
                      ? "bg-brand-50 text-brand-900"
                      : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                  }`}
                >
                  <span className="font-mono text-2xs text-ink-faint">{i + 1}</span>
                  {s.name}
                </button>
              </li>
            ))}
          </ol>
        </header>

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
          style={{ "--reveal-index": "1" } as React.CSSProperties}
        >
          <h2 className="text-xs font-semibold text-ink-muted mb-4 uppercase tracking-wide">Assessment details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Field label="Project name" value={meta.project} onChange={v => setMeta("project", v)} placeholder="Project name" />
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
            <div className="reveal" style={{ "--reveal-index": "2" } as React.CSSProperties}>
              <StageNav active={activeStage} statuses={statuses} onSelect={setActiveStage} />
              <StageHeader stageId={activeStage} statuses={statuses} />
            </div>

            <div className="reveal" style={{ "--reveal-index": "3" } as React.CSSProperties}>
              <PillarFilter
                items={itemsForStage(activeStage)}
                statuses={statuses}
                active={pillar}
                onChange={setPillar}
              />

              <div className="space-y-5">
                {stage.sections.map(section => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    statuses={statuses}
                    notes={notes}
                    onStatus={setStatus}
                    onNote={setNote}
                    pillar={pillar}
                  />
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-6 reveal" style={{ "--reveal-index": "4" } as React.CSSProperties}>
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

              <MaturitySummary statuses={statuses} />
            </div>
          </div>
        </div>
      </main>
    </>
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
      {/* suppressHydrationWarning is for third-party DOM mutation, not for our
          own mismatches.
          Enterprise browsers and password managers annotate form fields before
          React hydrates — Island Browser adds `island_form_infra_*` and
          `island_field_signature` to every text input, which React then reports
          as a server/client attribute mismatch on all six fields here. Nothing in
          this component varies between server and client: value comes from state
          that starts empty, and id is derived from the static label.
          The suppression is scoped to this element's attributes only, and the
          cost of leaving it noisy is that a real hydration error gets lost in
          six spurious ones. */}
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        suppressHydrationWarning
        className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
      />
    </div>
  );
}
