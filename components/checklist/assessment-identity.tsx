"use client";

import React, { useState } from "react";
import { ArchitecturePanel } from "./architecture-panel";
import { useAssessmentContext } from "./assessment-provider";

// Everything true of the engagement rather than of a stage: who is assessing
// what, against which targets, and who signs it off.
//
// It reads as a strip because on the landing page it is a cover sheet, not a
// form — the four facts that identify the document, and a disclosure for the
// rest. The rest is genuinely long (six text fields plus a six-column tier
// table), and a landing page whose job is "choose where to go" cannot open with
// it.
//
// The tier table lives in here rather than on the stage routes because there is
// one set of workload tiers per assessment, not one per stage. Rendering it on
// all four stage pages would show the same table four times and invite the
// reading that each stage has its own targets.

export function AssessmentIdentity() {
  const { ctrl } = useAssessmentContext();
  const { assessment, setMeta } = ctrl;
  const { meta } = assessment;

  const [open, setOpen] = useState(false);

  return (
    <div className="bg-surface rounded-card border border-line shadow-card mb-6">
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-x-9 gap-y-4">
        <div className="flex flex-wrap items-center gap-x-9 gap-y-4 min-w-0">
          <Fact label="Project" value={meta.project} placeholder="Not set" strong />
          <Fact label="Cluster" value={meta.clusterName} placeholder="Not set" mono />
          <Fact label="Assessor" value={meta.assessor} placeholder="Not set" />
          <Fact label="Date" value={meta.date} placeholder="Not set" tabular />
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="text-xs font-semibold text-brand-700 hover:underline shrink-0"
        >
          {open ? "Hide details" : "Edit details, targets & sign-offs"} {open ? "↑" : "→"}
        </button>
      </div>

      {open && (
        <div className="border-t border-line px-5 py-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Project name" value={meta.project} onChange={v => setMeta("project", v)} placeholder="Project name" />
            <Field label="Cluster" value={meta.clusterName} onChange={v => setMeta("clusterName", v)} placeholder="Cluster name or context" />
            <Field label="Assessor" value={meta.assessor} onChange={v => setMeta("assessor", v)} placeholder="Who performed this" />
            <Field label="Date" value={meta.date} onChange={v => setMeta("date", v)} type="date" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-line">
            <Field label="Sign-off — Platform" value={meta.signoffPlatform} onChange={v => setMeta("signoffPlatform", v)} placeholder="Name & date" />
            <Field label="Sign-off — Security / Compliance" value={meta.signoffSecurity} onChange={v => setMeta("signoffSecurity", v)} placeholder="Name & date" />
            <Field label="Sign-off — Workload owner" value={meta.signoffWorkloadOwner} onChange={v => setMeta("signoffWorkloadOwner", v)} placeholder="Name & date" />
          </div>

          {/* RPO/RTO used to be a textarea. It lives in the tier table because a
              textarea cannot tell you that a two-hour RTO and an export-only
              topology are incompatible. */}
          <div id="tiers" className="scroll-mt-24 pt-1">
            <ArchitecturePanel
              tiers={assessment.tiers}
              notes={meta.rtoRpoNotes}
              onTierChange={ctrl.updateTier}
              onAddTier={ctrl.addTier}
              onRemoveTier={ctrl.removeTier}
              onNotesChange={v => setMeta("rtoRpoNotes", v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Fact({
  label,
  value,
  placeholder,
  strong = false,
  mono = false,
  tabular = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  strong?: boolean;
  mono?: boolean;
  tabular?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint mb-0.5">{label}</div>
      <div
        className={`text-sm truncate ${strong ? "font-semibold text-ink" : "text-ink-soft"} ${
          mono ? "font-mono" : ""
        } ${tabular ? "tabular-nums" : ""} ${value ? "" : "text-ink-faint italic"}`}
      >
        {value || placeholder}
      </div>
    </div>
  );
}

export function Field({
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
