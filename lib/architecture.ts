// Reference architecture: workload tiers and DR topology.
//
// From section 4.3, section 4.5 and section 4.7 of The Kasten Resilience Playbook. The playbook's
// position, which this module encodes, is that RPO/RTO requirements per workload
// tier drive the architecture rather than the other way around — so the tier
// table comes first and the topology choice is made against it, with the
// playbook's own RTO characteristics visible at the point of choosing.
//
// Before this existed the app asked "cold / warm / export-only topology chosen
// per workload tier" as a single yes/no with no help choosing, and recorded
// RPO/RTO as one free-text box. A textarea cannot tell you that a two-hour RTO
// and an export-only topology are incompatible.
//
// Warnings here inform, they do not gate. The RTO ranges below are the
// playbook's own words rendered as rough numeric floors so a mismatch can be
// spotted; they are not a substitute for the customer's measurement, which is
// why a measured restore time overrides the estimate in the UI.

export type DrTopology = "undecided" | "export-only" | "cold" | "warm";

export interface TopologyInfo {
  label: string;
  summary: string;
  /** The playbook's stated RTO characteristic, verbatim in spirit. */
  rtoRange: string;
  /**
   * Rough floor in minutes below which this topology is not credible.
   * `null` means no opinion. Deliberately generous — the goal is to catch
   * "export-only with a 30-minute RTO", not to quibble over 10 minutes.
   */
  realisticFloorMinutes: number | null;
  cost: string;
  suitability: string;
}

export const TOPOLOGIES: Record<DrTopology, TopologyInfo> = {
  undecided: {
    label: "Not yet decided",
    summary: "No topology chosen for this tier.",
    rtoRange: "—",
    realisticFloorMinutes: null,
    cost: "—",
    suitability: "Decide before go-live: the Go-Live gate asks for a topology per tier.",
  },
  "export-only": {
    label: "Export only",
    summary:
      "No standby infrastructure. In a disaster, a Kubernetes environment and Kasten are rebuilt from scratch and workloads restored from exported restore points.",
    rtoRange: "multi-hour to multi-day",
    realisticFloorMinutes: 240,
    cost: "No ongoing infrastructure cost",
    suitability: "Acceptable when a multi-hour to multi-day RTO is tolerable.",
  },
  cold: {
    label: "Cold standby",
    summary:
      "Recovery cluster provisioned on demand from its cluster profile when a failure occurs. No replication to maintain.",
    rtoRange: "30 minutes to several hours",
    realisticFloorMinutes: 30,
    cost: "No ongoing infrastructure cost",
    suitability: "Non-production tiers, and production workloads where the SLA permits.",
  },
  warm: {
    label: "Warm standby",
    summary:
      "Recovery cluster pre-provisioned and kept idle or lightly loaded, with backup data continuously imported into a standby catalog.",
    rtoRange: "minutes to tens of minutes",
    realisticFloorMinutes: 5,
    cost: "Ongoing cost of the idle cluster",
    suitability: "Production workloads with tight RTO requirements.",
  },
};

export const TOPOLOGY_ORDER: DrTopology[] = ["undecided", "export-only", "cold", "warm"];

export interface WorkloadTier {
  /** Stable id — saved state and the PDF are keyed on it. */
  id: string;
  name: string;
  /** Free text so "1h", "15 min" and "24 hours" all work. */
  rpoTarget: string;
  rtoTarget: string;
  topology: DrTopology;
  /** Actual restore time observed in a test or drill. The number that matters. */
  measuredRestore: string;
  notes: string;
}

/** The playbook's three tiers, pre-seeded. Users can rename, add and remove. */
export function defaultTiers(): WorkloadTier[] {
  return [
    { id: "tier-production", name: "Production", rpoTarget: "", rtoTarget: "", topology: "undecided", measuredRestore: "", notes: "" },
    { id: "tier-non-production", name: "Non-production", rpoTarget: "", rtoTarget: "", topology: "undecided", measuredRestore: "", notes: "" },
    { id: "tier-edge", name: "Edge", rpoTarget: "", rtoTarget: "", topology: "undecided", measuredRestore: "", notes: "" },
  ];
}

/**
 * Tolerant duration parser: "4h", "90 min", "2 days", "1h30m", "36 hours".
 *
 * A bare number is read as hours, which is the common shorthand in an RTO
 * conversation — the input placeholder says so, since the alternative reading
 * changes the answer by 60x.
 *
 * Returns null when nothing parseable is found, and callers treat null as
 * "no opinion" rather than as zero. Silence beats a confident wrong warning.
 */
export function parseDurationMinutes(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const re = /(\d+(?:\.\d+)?)\s*(weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m)?/g;
  let total = 0;
  let matched = false;
  let m: RegExpExecArray | null;

  while ((m = re.exec(s)) !== null) {
    if (m[0].trim() === "") continue;
    const n = Number.parseFloat(m[1]);
    if (!Number.isFinite(n)) continue;
    matched = true;
    const unit = m[2] ?? "h";
    if (unit.startsWith("w")) total += n * 10080;
    else if (unit.startsWith("d")) total += n * 1440;
    else if (unit.startsWith("m")) total += n;
    else total += n * 60;
  }
  return matched ? total : null;
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 1440) {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = mins / 1440;
  return d % 1 === 0 ? `${d}d` : `${d.toFixed(1)}d`;
}

export type WarningSeverity = "warn" | "info";

export interface TierWarning {
  tierId: string;
  severity: WarningSeverity;
  text: string;
}

/**
 * Inconsistencies worth a customer's attention. Three kinds, in order of how
 * often they turn out to matter:
 *
 *  1. The chosen topology cannot plausibly deliver the stated RTO. This is the
 *     conversation the playbook exists to force.
 *  2. A measured restore time already exceeds the target. Not a prediction —
 *     it has happened, so the commitment is currently unmet.
 *  3. Targets recorded with no topology chosen, or the reverse.
 */
export function tierWarnings(tiers: WorkloadTier[]): TierWarning[] {
  const out: TierWarning[] = [];

  for (const tier of tiers) {
    const info = TOPOLOGIES[tier.topology];
    const rto = parseDurationMinutes(tier.rtoTarget);
    const rpo = parseDurationMinutes(tier.rpoTarget);
    const measured = parseDurationMinutes(tier.measuredRestore);
    const label = tier.name.trim() || "This tier";

    if (rto !== null && info.realisticFloorMinutes !== null && rto < info.realisticFloorMinutes) {
      out.push({
        tierId: tier.id,
        severity: "warn",
        text: `${label}: ${info.label} implies an RTO of ${info.rtoRange}, but the target is ${formatMinutes(rto)}. Either the topology needs to change or the commitment does (Playbook section 4.7).`,
      });
    }

    if (measured !== null && rto !== null && measured > rto) {
      out.push({
        tierId: tier.id,
        severity: "warn",
        text: `${label}: the measured restore took ${formatMinutes(measured)} against a ${formatMinutes(rto)} target. The RTO is currently unmet — raise an action or revise the target.`,
      });
    }

    if (tier.topology === "undecided" && (rto !== null || rpo !== null)) {
      out.push({
        tierId: tier.id,
        severity: "info",
        text: `${label}: targets recorded but no DR topology chosen yet.`,
      });
    }

    if (tier.topology !== "undecided" && rto === null) {
      out.push({
        tierId: tier.id,
        severity: "info",
        text: `${label}: a topology is chosen but no RTO target is recorded, so there is nothing to validate it against.`,
      });
    }
  }

  return out;
}

/** Compact one-line summary of a tier, for the PDF. */
export function describeTier(tier: WorkloadTier): string {
  const info = TOPOLOGIES[tier.topology];
  const parts = [
    `RPO ${tier.rpoTarget.trim() || "—"}`,
    `RTO ${tier.rtoTarget.trim() || "—"}`,
    info.label,
  ];
  if (tier.measuredRestore.trim()) parts.push(`measured ${tier.measuredRestore.trim()}`);
  return parts.join("  ·  ");
}
