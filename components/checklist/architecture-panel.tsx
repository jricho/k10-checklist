"use client";

import { useState } from "react";
import {
  TOPOLOGIES,
  TOPOLOGY_ORDER,
  formatMinutes,
  parseDurationMinutes,
  tierWarnings,
  type DrTopology,
  type WorkloadTier,
} from "../../lib/architecture";
import { AlertIcon, CheckIcon, ExternalLinkIcon } from "../ui/icon";
import { Chip, Panel, PanelHeader } from "../ui/panel";

// Workload tiers and DR topology — Playbook sections 4.3 and 4.7.
//
// The playbook's sequence is requirements first, architecture second. So this
// panel reads left to right as that argument: name the tier, state what the
// business will tolerate losing and how long it will tolerate being down, then
// choose the topology that can deliver it — with the playbook's own RTO
// characteristics visible while choosing rather than three clicks away in a PDF.
//
// The measured column is the one that settles arguments. A target is an
// intention; a measured restore is what happened.

function TierRow({
  tier,
  onChange,
  onRemove,
  canRemove,
}: {
  tier: WorkloadTier;
  onChange: (patch: Partial<WorkloadTier>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const info = TOPOLOGIES[tier.topology];
  const rpo = parseDurationMinutes(tier.rpoTarget);
  const rto = parseDurationMinutes(tier.rtoTarget);
  const measured = parseDurationMinutes(tier.measuredRestore);

  /**
   * Echo how the input was read. A bare "30" is interpreted as 30 hours, which
   * is the right guess for an RTO conversation but the wrong one if the user
   * meant minutes — and a silent 60x misreading would quietly disable the
   * topology warning. Showing the interpretation makes it self-correcting.
   */
  const echo = (raw: string, mins: number | null) =>
    mins !== null && raw.trim() !== formatMinutes(mins) ? (
      <p className="text-[11px] text-ink-muted mt-1">= {formatMinutes(mins)}</p>
    ) : null;
  const overTarget = rto !== null && measured !== null && measured > rto;
  const withinTarget = rto !== null && measured !== null && measured <= rto;

  const cell =
    "w-full border border-line-strong rounded-md px-2 py-1.5 text-[12px] text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent";

  return (
    <div className="grid grid-cols-12 gap-2 items-start py-3 border-b border-line last:border-b-0">
      <div className="col-span-12 md:col-span-3">
        <label className="sr-only" htmlFor={`${tier.id}-name`}>
          Tier name
        </label>
        <input
          id={`${tier.id}-name`}
          value={tier.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Tier name"
          className={`${cell} font-semibold`}
        />
      </div>

      <div className="col-span-6 md:col-span-1">
        <label className="sr-only" htmlFor={`${tier.id}-rpo`}>
          RPO target
        </label>
        <input
          id={`${tier.id}-rpo`}
          value={tier.rpoTarget}
          onChange={e => onChange({ rpoTarget: e.target.value })}
          placeholder="1h"
          title="Maximum acceptable data loss. A bare number is read as hours."
          className={cell}
        />
        {echo(tier.rpoTarget, rpo)}
      </div>

      <div className="col-span-6 md:col-span-1">
        <label className="sr-only" htmlFor={`${tier.id}-rto`}>
          RTO target
        </label>
        <input
          id={`${tier.id}-rto`}
          value={tier.rtoTarget}
          onChange={e => onChange({ rtoTarget: e.target.value })}
          placeholder="4h"
          title="Maximum acceptable downtime. A bare number is read as hours."
          className={cell}
        />
        {echo(tier.rtoTarget, rto)}
      </div>

      <div className="col-span-12 md:col-span-3">
        <label className="sr-only" htmlFor={`${tier.id}-topology`}>
          DR topology
        </label>
        <select
          id={`${tier.id}-topology`}
          value={tier.topology}
          onChange={e => onChange({ topology: e.target.value as DrTopology })}
          className={cell}
        >
          {TOPOLOGY_ORDER.map(key => (
            <option key={key} value={key}>
              {TOPOLOGIES[key].label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-ink-muted mt-1 leading-snug">
          {tier.topology === "undecided" ? info.suitability : `RTO ${info.rtoRange} · ${info.cost}`}
        </p>
      </div>

      <div className="col-span-8 md:col-span-2">
        <label className="sr-only" htmlFor={`${tier.id}-measured`}>
          Measured restore time
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={`${tier.id}-measured`}
            value={tier.measuredRestore}
            onChange={e => onChange({ measuredRestore: e.target.value })}
            placeholder="measured"
            title="Actual restore time observed in a test or drill"
            className={cell}
          />
          {overTarget && (
            <span title="Exceeds the RTO target" className="shrink-0">
              <AlertIcon className="text-red-600" />
            </span>
          )}
          {withinTarget && (
            <span title="Within the RTO target" className="shrink-0">
              <CheckIcon className="text-brand-700" />
            </span>
          )}
        </div>
        {echo(tier.measuredRestore, measured)}
      </div>

      <div className="col-span-4 md:col-span-2 flex items-start justify-end gap-2">
        <input
          value={tier.notes}
          onChange={e => onChange({ notes: e.target.value })}
          placeholder="note"
          aria-label={`Note for ${tier.name || "this tier"}`}
          className={cell}
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove this tier"
            aria-label={`Remove ${tier.name || "tier"}`}
            className="text-line-strong hover:text-red-600 text-lg leading-none px-1 shrink-0"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function ArchitecturePanel({
  tiers,
  notes,
  onTierChange,
  onAddTier,
  onRemoveTier,
  onNotesChange,
}: {
  tiers: WorkloadTier[];
  notes: string;
  onTierChange: (id: string, patch: Partial<WorkloadTier>) => void;
  onAddTier: () => void;
  onRemoveTier: (id: string) => void;
  onNotesChange: (notes: string) => void;
}) {
  const warnings = tierWarnings(tiers);
  const hard = warnings.filter(w => w.severity === "warn");
  const soft = warnings.filter(w => w.severity === "info");

  // Collapsed by default, matching the checklist sections. The table is a
  // six-column form that is revisited occasionally — at the start of a POC, and
  // again when a drill produces a measured restore time — not something you read
  // on every visit.
  //
  // The header therefore has to answer "is there anything here I need to look
  // at" while shut: how many tiers are defined, how many still have no topology,
  // and how many carry an unresolved warning. A collapsed panel that shows only
  // its title makes the reader open it to find out there was nothing to see.
  const [open, setOpen] = useState(false);
  const undecided = tiers.filter(t => t.topology === "undecided").length;

  return (
    <Panel>
      <PanelHeader
        title="Workload tiers & DR topology"
        onClick={() => setOpen(v => !v)}
        expanded={open}
        meta={
          <>
            {hard.length > 0 && (
              <Chip tone="warn">
                {hard.length} {hard.length === 1 ? "conflict" : "conflicts"}
              </Chip>
            )}
            {undecided > 0 && <Chip tone="neutral">{undecided} without a topology</Chip>}
            <Chip tone={undecided === 0 && hard.length === 0 ? "brand" : "neutral"}>
              {tiers.length} {tiers.length === 1 ? "tier" : "tiers"}
            </Chip>
          </>
        }
        action={
          <a
            href="/kasten-resilience-playbook.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Playbook 4.3, 4.7 <ExternalLinkIcon />
          </a>
        }
      />
      {!open ? null : (
        <div className="px-5 py-4">
      <p className="text-[13px] text-ink-muted mb-5 max-w-3xl leading-relaxed">
        Requirements drive the architecture, not the other way around. Define what each tier can tolerate losing and how
        long it can be down, then choose the topology that can deliver it. Everything here prints on the cover of the
        exported PDF, and the DR items in Go-Live are assessed against it.
      </p>

      <div className="hidden md:grid grid-cols-12 gap-2 pb-2 border-b border-line text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
        <div className="col-span-3">Workload tier</div>
        <div className="col-span-1">RPO</div>
        <div className="col-span-1">RTO</div>
        <div className="col-span-3">DR topology</div>
        <div className="col-span-2">Measured</div>
        <div className="col-span-2 text-right">Note</div>
      </div>

      <div>
        {tiers.length === 0 ? (
          <p className="text-[13px] text-ink-faint py-4">No tiers defined.</p>
        ) : (
          tiers.map(tier => (
            <TierRow
              key={tier.id}
              tier={tier}
              onChange={patch => onTierChange(tier.id, patch)}
              onRemove={() => onRemoveTier(tier.id)}
              canRemove={tiers.length > 1}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onAddTier}
        className="mt-3 text-xs font-semibold text-brand-700 hover:underline"
      >
        + Add a tier
      </button>

      {(hard.length > 0 || soft.length > 0) && (
        <div className="mt-5 space-y-2">
          {hard.map((w, i) => (
            <div
              key={`w-${i}`}
              role="status"
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 leading-relaxed"
            >
              {w.text}
            </div>
          ))}
          {soft.map((w, i) => (
            <p key={`i-${i}`} className="text-[12px] text-ink-faint px-1">
              {w.text}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-line">
        <label htmlFor="tier-notes" className="block text-sm font-medium text-ink-soft mb-1">
          Additional RPO / RTO context
        </label>
        <p className="text-[12px] text-ink-muted mb-1.5">
          Who set these targets, what constrains them, and anything deliberately out of scope.
        </p>
        <textarea
          id="tier-notes"
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="e.g. Production RTO agreed with the trading desk, Feb 2026. Edge sites have a 4h connectivity window overnight, which caps achievable RPO."
          className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm text-ink min-h-[72px] resize-y focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
        />
      </div>

      <details className="mt-5">
        <summary className="text-xs font-semibold text-ink-muted cursor-pointer hover:text-ink-soft">
          Topology reference (Playbook section 4.7)
        </summary>
        <div className="mt-3 space-y-3">
          {TOPOLOGY_ORDER.filter(k => k !== "undecided").map(key => {
            const t = TOPOLOGIES[key];
            return (
              <div key={key} className="text-[12px] leading-relaxed">
                <span className="font-semibold text-ink">{t.label}</span>
                <span className="text-ink-faint"> — RTO {t.rtoRange} · {t.cost}</span>
                <p className="text-ink-muted">{t.summary}</p>
                <p className="text-ink-faint italic">{t.suitability}</p>
              </div>
            );
          })}
          <p className="text-[11px] text-ink-faint pt-2 border-t border-line">
            This reference architecture uses an independent-cluster topology throughout: each cluster is self-contained
            and recovery means restoring onto a separately provisioned cluster. Stretched clusters are explicitly out of
            scope.
          </p>
        </div>
      </details>
        </div>
      )}
    </Panel>
  );
}
