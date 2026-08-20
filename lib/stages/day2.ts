import type { Stage } from "../checklist-types";
import * as C from "../commands";

/**
 * STAGE 4 — Day-2 Operations.
 *
 * Maps to Phase 4 of the 100-day roadmap (Days 76–100, Milestones 10–12) and
 * everything after it.
 *
 * The first three stages are a project and they end. This one does not, which is
 * why it is structured by cadence rather than by task: the Playbook's warning is
 * that a Level 3 environment silently drifts back toward Level 1 as clusters,
 * applications and teams change. Re-run this stage on its cadence and at every
 * major upgrade; the export is the evidence trail.
 */
export const DAY2_STAGE: Stage = {
  id: "day2",
  name: "Day-2 Operations",
  strapline: "Sustain and advance maturity — this stage never completes",
  roadmapPhase: "Roadmap Phase 4 — Prove Value (Days 76–100, M10–M12) and beyond",
  goal:
    "Keep recoverability true as the estate changes: a recurring cadence, drills that measure rather than reassure, and findings that change something.",
  maturityTarget: "Sustains Level 4, builds toward Level 5",
  exitCriteria: [
    "This stage has no exit — it has a review date",
    "Coverage is audited monthly against live inventory, not against memory",
    "A documented restore test happens every quarter, rotating workload type",
    "Drill findings have demonstrably changed a policy, a runbook or a training plan",
  ],
  sections: [
    {
      id: "d2-cadence",
      title: "Operating cadence",
      intro:
        "Straight from the Playbook's day-2 operating model. The value is in the rhythm, not in any single check — each one is cheap and each one catches a class of silent drift.",
      items: [
        {
          id: "daily-alert-triage",
          label: "Daily: alerts triaged the same day, with no standing 'known failure'",
          why: "A backup alert that has been firing for three weeks has trained the team to ignore the channel. Tolerated failures are how an environment stops being protected without any decision being taken.",
          evidence: "No alert older than 24 hours unacknowledged; no permanently silenced backup alert.",
          cmd: C.ACTIONS_NOT_COMPLETE,
          signals: [["observability", 3]],
        },
        {
          id: "weekly-job-review",
          label: "Weekly: dashboard reviewed, failures and warnings cleared",
          why: "Warnings accumulate into a backlog nobody reads. Weekly is frequent enough that the list stays short enough to actually work through.",
          evidence: "A weekly review with the failed/warned list empty or each entry owned.",
          cmd: `${C.BACKUP_ACTION_HISTORY}; echo; ${C.ACTIONS_NOT_COMPLETE}`,
          signals: [["observability", 3]],
        },
        {
          id: "weekly-window-check",
          label: "Weekly: jobs still completing inside their window",
          why: "Backup duration creeps as data grows. The failure mode is gradual until the day the window is missed and jobs overlap into production hours.",
          evidence: "Job durations trending flat, or growth understood and the window adjusted before it is breached.",
          cmd: C.BACKUP_ACTION_HISTORY,
          signals: [["coverage", 4]],
        },
        {
          id: "monthly-coverage-audit",
          label: "Monthly: coverage audited against live inventory",
          why: "New namespaces appear constantly. Selector-driven policies catch most of them, and the exceptions — a new StorageClass, a namespace that does not match any label convention, a team that invented their own — are exactly the ones nobody hears about.",
          evidence: "The PVC-holding namespace list fully accounted for by policy selectors or the exclusion list. Deltas since last month noted.",
          cmd: `${C.NAMESPACES_WITH_PVCS}; echo; ${C.POLICY_SUMMARY}; echo; ${C.SC_WITHOUT_SNAPSHOT_CLASS}`,
          blocking: true,
          signals: [["coverage", 4]],
        },
        {
          id: "monthly-upgrade-review",
          label: "Monthly: releases reviewed and upgrades applied on a tested cadence",
          why: "Kasten ships roughly every two weeks. Deferring indefinitely means the eventual upgrade is a large, untested jump — usually attempted under pressure because a fix is needed.",
          evidence: "Installed version within a bounded distance of current, with upgrades tested in non-production first.",
          cmd: `${C.K10_VERSION_INSTALLED}; echo '--- available ---'; helm repo update kasten >/dev/null 2>&1; helm search repo kasten/k10 --versions 2>/dev/null | head -5`,
          blocking: true,
          signals: [["central", 4]],
        },
        {
          id: "k8s-upgrade-coupling",
          label: "Cluster upgrades gated on Kasten compatibility, with a fresh backup first",
          why: "Two failure modes, both common: upgrading Kubernetes past what the installed Kasten supports, and upgrading a cluster with no recent backup. The second turns a routine rollback into data loss.",
          evidence: "The platform upgrade runbook contains a Kasten compatibility check and a verified backup as prerequisites.",
          cmd: `${C.K8S_VERSION}; echo; ${C.K10_VERSION_INSTALLED}`,
          signals: [["central", 4]],
        },
        {
          id: "quarterly-restore-test",
          label: "Quarterly: documented restore test, rotating workload type",
          why: "Restoring the same friendly workload every quarter proves that workload is recoverable. Rotating types is what finds the Blueprint that broke, the operator that needs ordering, and the volume that grew past the window.",
          evidence: "A restore test per quarter, a different workload class each time, with measured time against target.",
          cmd: C.RESTORE_DURATIONS,
          blocking: true,
          signals: [["people", 4]],
        },
        {
          id: "annual-architecture-review",
          label: "Annually: architecture and DR topology reviewed against current requirements",
          why: "The estate that the architecture was designed for is not the estate you have a year later. Cluster count, data volume, regulatory scope and RTO expectations all move.",
          evidence: "A dated review with any change to topology or tiering recorded.",
          signals: [["people", 5], ["observability", 5]],
        },
        {
          id: "annual-maturity-reassessment",
          label: "Annually: maturity self-assessment repeated and deltas tracked",
          why: "Maturity is the only measure here that spans dimensions, and the Playbook asks for at least annual reassessment — or sooner after an incident, a drill, fleet growth or a new regulatory requirement. Tracking the delta is what turns it from a scoring exercise into a programme.",
          evidence:
            "The workbook re-scored, current versus previous levels compared, and the largest remaining gaps carried into the next planning cycle.",
          blocking: true,
          signals: [["people", 5]],
        },
        {
          id: "prerenewal-licence-review",
          label: "Before renewal: entitlement reviewed across the fleet",
          why: "Fleet growth outpaces entitlement quietly, and renewal is a poor time to discover it.",
          evidence: "Node count per cluster against entitlement, with growth projected to the next renewal.",
          cmd: C.LICENCE_INPUTS,
          signals: [["observability", 5]],
        },
      ],
    },
    {
      id: "d2-validation",
      title: "Recovery testing & drills",
      intro:
        "A disaster recovery procedure that has never been executed is an assumption, not a capability. Drills are mandatory, not optional.",
      items: [
        {
          id: "drill-schedule",
          label: "A DR drill calendar exists with named participants",
          why: "Drills that are not scheduled do not happen — there is always a release. Naming participants in advance also stops the drill from only ever involving the person who already knows the answers.",
          evidence: "Dates and names for the next four quarters.",
          signals: [["dr", 4], ["people", 4]],
        },
        {
          id: "drill-measures-rto",
          label: "Drills record measured RTO and RPO against target, and misses raise actions",
          why: "A drill that produces 'it worked' is a morale exercise. A drill that produces 'four hours seventeen minutes against a two-hour target' produces a decision — more standby, less data, or an honest revision of the commitment.",
          evidence: "Measured times per drill, compared to target, with a raised action for every miss.",
          cmd: C.RESTORE_DURATIONS,
          blocking: true,
          signals: [["dr", 4]],
        },
        {
          id: "drill-full-cluster-loss",
          label: "At least one full cluster-loss drill per year",
          why: "Namespace restores exercise a fraction of the recovery path. Rebuilding a cluster, recovering the Kasten catalog from Kasten DR and restoring the estate is the scenario the whole architecture exists for, and the only one that tests the dependency walk end to end.",
          evidence: "A dated full-loss drill: cluster rebuilt, catalog recovered, workloads restored, applications validated by their owners.",
          blocking: true,
          signals: [["dr", 4], ["people", 4]],
        },
        {
          id: "drill-findings-loop",
          label: "Drill findings demonstrably change policy, architecture or training",
          why: "This is the whole difference between Level 4 and Level 5. Findings that are recorded and not acted on make the next drill produce the same findings.",
          evidence: "A traceable change — a runbook version bump, a policy edit, a training session — for each significant finding.",
          signals: [["people", 5]],
        },
        {
          id: "game-days-automated",
          label: "Game-day exercises automated and run on a schedule",
          why: "Automated, routine failure injection is what keeps recovery from decaying between manual drills.",
          evidence: "An automated exercise running on a schedule with results published.",
          conditional: true,
          signals: [["dr", 5]],
        },
      ],
    },
    {
      id: "d2-capacity",
      title: "Capacity, cost & hygiene",
      items: [
        {
          id: "storage-growth-alerting",
          label: "Backup storage growth trended, with spikes alerted",
          why: "An unexpected growth spike means one of three things: someone included a high-churn ephemeral volume, data is corrupting, or something is encrypting volumes. All three are worth an alert, and the third is worth a page.",
          evidence: "Growth trend visible with a threshold alert, and each past spike explained.",
          signals: [["storage", 4]],
        },
        {
          id: "lifecycle-tiering",
          label: "Lifecycle rules move aged backups to cheaper tiers without breaking retention",
          why: "Backup archives grow monotonically and are the easiest storage line to reduce. The constraint is that lifecycle rules and Kasten retention must agree, and that archival tiers have retrieval times that change RTO.",
          evidence: "Lifecycle rules documented alongside retention, with the retrieval-time impact on RTO acknowledged.",
          signals: [["storage", 4]],
        },
        {
          id: "orphan-snapshot-sweep",
          label: "Orphaned snapshot contents and stale restore points swept",
          why: "Snapshot leakage is a real and boring problem: contents whose VolumeSnapshot is gone keep consuming array capacity and cost, and nothing reports them.",
          evidence: "The orphan report empty or each entry explained. Include this in the monthly audit.",
          cmd: `${C.ORPHANED_SNAPSHOT_CONTENTS}; echo; ${C.SNAPSHOT_INVENTORY}`,
          signals: [["storage", 4]],
        },
        {
          id: "catalog-health",
          label: "Catalog volume utilisation and Kasten pod restarts trended",
          why: "The catalog is the component whose loss hurts most and whose growth is least watched. A full catalog PVC is an outage; a restarting catalog pod is the warning.",
          evidence: "Catalog PVC utilisation and pod restart counts on a dashboard with a threshold alert.",
          cmd: `kubectl get pvc -n ${C.K10_NS}; echo; ${C.K10_POD_HEALTH}`,
          signals: [["observability", 3]],
        },
        {
          id: "finops-review",
          label: "Backup storage cost reviewed with FinOps",
          why: "A Level 5 practice: continuous optimisation rather than an annual surprise.",
          evidence: "Backup storage cost reviewed on a cadence, with tiering decisions taken jointly.",
          conditional: true,
          signals: [["storage", 5]],
        },
      ],
    },
    {
      id: "d2-governance",
      title: "Governance, people & continuous improvement",
      items: [
        {
          id: "coverage-as-governance-metric",
          label: "Coverage reported as 'policied and tested', not 'installed'",
          why: "The Playbook's sharpest distinction. 'Kasten is deployed on 40 clusters' answers nothing an auditor or a board asks. 'Thirty-eight of forty clusters have active policies covering every PVC-holding namespace, and 12 of 40 have had a restore tested this quarter' is the actual risk position.",
          evidence: "A fleet metric combining active policy coverage and recency of a successful restore test, reported to leadership.",
          cmd: `${C.NAMESPACES_WITH_PVCS}; echo; ${C.POLICY_SUMMARY}`,
          blocking: true,
          signals: [["observability", 4]],
        },
        {
          id: "compliance-evidence-pack",
          label: "Compliance evidence produced routinely, not assembled during audits",
          why: "SOC 2 auditors expect documented evidence that backup procedures operate as designed; PCI-DSS and HIPAA add retention requirements. Producing this on a cadence turns audit prep into a download.",
          evidence: "A recurring evidence pack: coverage report, job outcomes, restore test results, retention configuration.",
          signals: [["observability", 4]],
        },
        {
          id: "onboarding-automated",
          label: "New applications and business units protected with zero manual configuration",
          why: "Level 5 coverage: label conventions enforced at admission or by GitOps templates, so protection is a property of deployment rather than a follow-up ticket.",
          evidence: "A new namespace created through the standard path is protected without any backup-specific action.",
          signals: [["coverage", 5]],
        },
        {
          id: "blueprint-library-owned",
          label: "In-house Blueprint library with a named owner",
          why: "New engines get adopted continuously. Without an owned library, each one arrives crash-consistent and nobody notices until a restore.",
          evidence: "A version-controlled Blueprint library with an owner and a review cadence.",
          signals: [["appconsistency", 5]],
        },
        {
          id: "self-service-restore",
          label: "Namespace-scoped self-service restore available to application teams",
          why: "Self-service restore within RBAC boundaries removes the platform team from the critical path of routine recovery, which shortens real recovery times far more than most infrastructure changes.",
          evidence: "Application teams restoring their own namespaces within RBAC boundaries, with an audit trail.",
          cmd: C.K10_RBAC,
          conditional: true,
          signals: [["central", 5]],
        },
      ],
    },
  ],
};
