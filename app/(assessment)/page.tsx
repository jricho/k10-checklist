"use client";

import React from "react";
import Link from "next/link";
import { AssessmentIdentity } from "../../components/checklist/assessment-identity";
import { MaturityTile } from "../../components/checklist/maturity-tile";
import { useAssessmentContext } from "../../components/checklist/assessment-provider";
import { GATE } from "../../components/checklist/gate";
import { STAGES, STAGES_BY_ID, progressForStage } from "../../lib/checklist-data";
import { ROUTES, stageHref } from "../../lib/routes";
import { DocumentIcon, DownloadIcon, ExternalLinkIcon, SpreadsheetIcon } from "../../components/ui/icon";

// The overview: where a customer decides what to do next.
//
// Organised by the job rather than by the stage, because someone arriving at the
// tool is choosing an action, not identifying which phase of a roadmap they are
// nominally in. The two headings carry the separation the routes only imply —
// on the left, things you fill in, in order, each gating the next; on the right,
// things that are simply true of the estate, derived and read-only.
//
// Everything here is a door. The only editing on this page is the engagement
// detail behind the identity strip's disclosure, because that is the one thing
// that belongs to the assessment as a whole rather than to any stage.

export default function OverviewPage() {
  const { ctrl } = useAssessmentContext();
  const { assessment, loaded } = ctrl;
  const { statuses, activeStage } = assessment;

  const resumeStage = STAGES_BY_ID[activeStage];
  const resumeProgress = progressForStage(activeStage, statuses);
  // A fresh assessment has nothing to resume: offering "continue" to someone who
  // has answered nothing is an empty gesture, and the POC tile is already the
  // obvious move. `loaded` gates it so the bar cannot flash in before
  // localStorage has been read.
  //
  // The test is on the assessment as a whole, not on the last-visited stage.
  // Reading ahead is a normal thing to do — answer six items in the POC, click
  // through to Go-Live to see what is coming, then return — and keying the bar
  // on that stage's own progress made it vanish at exactly that moment, which is
  // when a customer most wants the way back.
  const resuming = loaded && Object.values(statuses).some(s => s !== "pending");

  return (
    <main className="max-w-[86rem] mx-auto px-6 py-7">
      <header className="mb-6 reveal" style={{ "--reveal-index": "0" } as React.CSSProperties}>
        <p className="font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-ink-muted mb-2">
          Veeam Kasten · Readiness assessment
        </p>
        <div className="flex flex-wrap items-start justify-between gap-6 mb-3">
          <h1 className="font-display text-2xl font-bold text-ink max-w-[24ch] sm:max-w-none">
            Readiness and operating maturity
          </h1>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
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
      </header>

      {ctrl.persistError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"
        >
          {ctrl.persistError}
        </div>
      )}

      <div className="reveal" style={{ "--reveal-index": "1" } as React.CSSProperties}>
        <AssessmentIdentity />
      </div>

      {resuming && (
        <Link
          href={stageHref(activeStage)}
          className="group block bg-surface rounded-card border border-line border-l-[3px] border-l-brand-600 shadow-raised px-6 py-5 mb-7 reveal"
          style={{ "--reveal-index": "2" } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint mb-1.5">
                Where you left off · Stage {STAGES.findIndex(s => s.id === activeStage) + 1}
              </div>
              <div className="font-display text-xl font-semibold text-ink mb-1">{resumeStage.jobTitle}</div>
              <div className="text-[13px] text-ink-muted">
                {resumeProgress.blockersOutstanding.length === 0
                  ? "No blocking items outstanding in this stage."
                  : `${resumeProgress.blockersOutstanding.length} blocking item${
                      resumeProgress.blockersOutstanding.length === 1 ? "" : "s"
                    } outstanding`}
              </div>
            </div>
            <div className="flex items-center gap-6 shrink-0">
              <div className="text-right">
                <div className="text-2xl font-bold text-ink tabular-nums leading-none">
                  {resumeProgress.passed}
                  <span className="text-base text-ink-faint font-semibold">/{resumeProgress.applicable}</span>
                </div>
                <div className="w-32 h-1 rounded-full overflow-hidden bg-line mt-2">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${resumeProgress.percent}%` }} />
                </div>
              </div>
              <span className="bg-brand-700 group-hover:bg-brand-800 text-white px-5 py-3 rounded-lg font-semibold text-[13px] transition-colors">
                Continue →
              </span>
            </div>
          </div>
        </Link>
      )}

      <div
        className="grid lg:grid-cols-5 gap-7 items-start reveal"
        style={{ "--reveal-index": "3" } as React.CSSProperties}
      >
        {/* min-w-0: a grid item defaults to min-width:auto, so the nowrap
            kubectl line in the capture tile pushed its track — and the whole
            document — wider than a phone viewport. */}
        <section className="lg:col-span-3 min-w-0">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg font-semibold text-ink">Do the work</h2>
            <span className="text-2xs text-ink-faint">Four stages, in order — each gates the next</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {STAGES.map((stage, i) => (
              <StageTile key={stage.id} index={i} stageId={stage.id} statuses={statuses} />
            ))}
          </div>
        </section>

        <section className="lg:col-span-2 min-w-0">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg font-semibold text-ink">Read the result</h2>
            <span className="text-2xs text-ink-faint">Derived — nothing to fill in</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <MaturityTile statuses={statuses} />
            <CaptureTile />
            <ExportCard />
          </div>
        </section>
      </div>
    </main>
  );
}

function StageTile({
  index,
  stageId,
  statuses,
}: {
  index: number;
  stageId: (typeof STAGES)[number]["id"];
  statuses: Parameters<typeof progressForStage>[1];
}) {
  const stage = STAGES_BY_ID[stageId];
  const p = progressForStage(stageId, statuses);
  const gate = GATE[p.gate];
  const started = p.passed + p.failed + p.na > 0;

  return (
    <Link
      href={stageHref(stageId)}
      className={`group block bg-surface rounded-card border shadow-card px-5 py-4 transition-colors ${
        started ? "border-line-strong" : "border-line hover:border-line-strong"
      }`}
    >
      <div className="flex gap-4 items-start">
        <span className="font-mono text-2xs font-semibold text-ink-faint pt-1 w-3.5 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-1">
            <span className="font-display text-lg font-semibold text-ink group-hover:text-brand-800 transition-colors">
              {stage.jobTitle}
            </span>
            <span className="text-2xs text-ink-faint">{stage.name}</span>
          </div>
          <p className="text-[13px] text-ink-muted leading-relaxed mb-2.5">{stage.strapline}</p>
          <div className="flex items-center gap-2.5">
            <div className="w-44 max-w-[45%] h-1 rounded-full overflow-hidden bg-line">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${p.percent}%` }} />
            </div>
            <span className="text-2xs font-semibold tabular-nums text-ink-muted">
              {p.passed}/{p.applicable}
            </span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {/* The gate travels with the tile. Without it a grid of four reads as
              four parallel choices, and Go-Live looks as available as the POC. */}
          <span className={`text-2xs font-bold tracking-[0.04em] px-2.5 py-1 rounded-md ${gate.badge}`}>
            {gate.label(p.blockersOutstanding.length)}
          </span>
          <span className="text-xs font-semibold text-brand-700">
            {started ? "Continue →" : p.gate === "blocked" ? "Read ahead →" : "Start →"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function CaptureTile() {
  const { ctrl, diagram } = useAssessmentContext();
  const { outputs } = ctrl.assessment;
  const captured = Object.values(outputs).filter(v => v.trim().length > 0).length;
  const total = Object.keys(outputs).length;

  return (
    <Link
      href={ROUTES.clusterCapture}
      className="group block bg-surface rounded-card border border-line hover:border-line-strong shadow-card p-5 transition-colors"
    >
      <h2 className="text-base font-semibold text-ink mb-1">Capture cluster evidence</h2>
      <p className="text-[13px] text-ink-muted leading-relaxed mb-3">
        Read-only captures and the architecture diagram, reproduced in the export.
      </p>
      <div className="bg-slate-900 rounded-lg px-3 py-2.5 mb-3 overflow-x-auto">
        <code className="font-mono text-2xs text-brand-200 whitespace-nowrap">
          $ kubectl get policies.config.kio.kasten.io -A
        </code>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xs text-ink-muted tabular-nums">
          {captured} of {total} captured · {diagram ? "diagram attached" : "no diagram"}
        </span>
        <span className="text-xs font-semibold text-brand-700 shrink-0">Open the tool →</span>
      </div>
    </Link>
  );
}

function ExportCard() {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-ink mb-0.5">Export the evidence pack</div>
        <div className="text-2xs text-ink-muted">Everything recorded so far, as a signable PDF</div>
      </div>
      {/* Deliberately quiet, and deliberately not a second Export button: the one
          in the header is the control, and two would be two answers to "where do
          I export". This says the pack exists and where it comes from. */}
      <span className="text-2xs text-ink-faint shrink-0 text-right">
        Export PDF,
        <br />
        top right
      </span>
    </div>
  );
}
