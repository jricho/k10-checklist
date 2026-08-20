import type { Stage } from "../checklist-types";
import * as C from "../commands";

/**
 * STAGE 3 — Go-Live Readiness.
 *
 * Maps to Phase 3 of the 100-day roadmap (Days 46–75, Milestones 7–9) plus the
 * cutover itself.
 *
 * Protection works and is automatic. This stage answers the question a change
 * board asks: when this fails at 03:00, will anyone know, and can someone who
 * did not build it recover the environment? Signing off this stage is what the
 * exported PDF is for.
 */
export const GOLIVE_STAGE: Stage = {
  id: "golive",
  name: "Go-Live",
  strapline: "Observable, alerting, DR designed and signed off",
  roadmapPhase: "Roadmap Phase 3 — Optimize & Harden (Days 46–75, M7–M9) + cutover",
  playbookRefs: [
    "§2.3 Level 4 descriptors",
    "§3.3 Incident response integration",
    "§4.3 Disaster recovery topology",
    "§4.7 Disaster recovery patterns",
    "§5 Roadmap Phase 3",
  ],
  goal:
    "Make failure visible, make recovery executable by someone who did not design it, and obtain sign-off against measured numbers rather than intentions.",
  maturityTarget: "Establishes Level 4 — recoverability proven, not assumed",
  exitCriteria: [
    "A deliberately failed job produced a real alert to the on-call rota",
    "Kasten DR is enabled and the cluster ID plus passphrase are escrowed off-cluster",
    "The DR runbook has been executed successfully by an engineer who did not write it",
    "Sign-off recorded from platform, security/compliance and the workload owner",
    "A baseline maturity self-assessment is archived with this checklist",
  ],
  sections: [
    {
      id: "go-observability",
      title: "Observability & alerting",
      intro:
        "The Playbook's phrasing is the test: failures should be alerted, not discovered. An unwatched dashboard is not monitoring.",
      items: [
        {
          id: "metrics-exported",
          label: "Kasten metrics scraped into the platform monitoring stack",
          why: "Kasten's bundled Prometheus is scoped to Kasten and nobody watches it. Metrics have to land where the platform team already looks, or they are not observability — they are a second place to forget to check.",
          evidence: "A ServiceMonitor/PodMonitor or scrape config in place, and Kasten metrics queryable from the main stack.",
          cmd: `${C.K10_MONITORING}; echo; ${C.K10_METRIC_NAMES}`,
          blocking: true,
          signals: [["observability", 3]],
        },
        {
          id: "alerts-defined",
          label: "Alerts defined for job failure, missed RPO, storage growth and licence expiry",
          why: "Job failure is the obvious one and the least interesting. A job that never ran fires no failure alert — absence of success is the condition that matters, and it needs an explicit rule.",
          evidence:
            "Alert rules covering: action failed, no successful action within the RPO window, backup storage growth anomaly, licence approaching expiry. Confirm the metric names exist on your version rather than copying rules blind.",
          cmd: C.K10_METRIC_NAMES,
          blocking: true,
          signals: [["observability", 3]],
        },
        {
          id: "alert-delivery-proven",
          label: "A deliberately failed job produced a real page or ticket",
          why: "Alert rules that have never fired are configuration, not coverage. The path from a failed export to a human being — through Alertmanager, the routing tree, the on-call schedule and the escalation policy — has at least four places to break silently, and all of them are cheap to test now.",
          evidence:
            "A test failure induced deliberately, with the resulting page or ticket attached, and the time from failure to notification recorded.",
          blocking: true,
          signals: [["observability", 3], ["people", 3]],
        },
        {
          id: "dashboards-published",
          label: "Dashboard published and shared with platform and application teams",
          why: "Application teams asking 'is my namespace protected' should not need to ask the platform team. It also spreads the noticing.",
          evidence: "A shared dashboard showing coverage, job outcomes and RPO compliance per namespace.",
          signals: [["observability", 2]],
        },
        {
          id: "logs-retained",
          label: "Kasten logs shipped off-cluster and retained",
          why: "Investigating a failure found three weeks later needs logs that outlived the pod — and logs on a cluster you are recovering are not available at the moment you need them most.",
          evidence: "Logs in the central platform with a retention period long enough for a quarterly review to be useful.",
          cmd: C.K10_LOGS,
          signals: [["observability", 3]],
        },
        {
          id: "incident-pipeline",
          label: "Backup failures routed into the normal incident management pipeline",
          why: "A backup alert that arrives in a channel nobody owns is decoration. Same pipeline, same severities, same escalation as any other platform failure.",
          evidence: "Backup alerts create incidents with an owner and an SLA, not just messages.",
          signals: [["observability", 3], ["people", 3]],
        },
        {
          id: "siem-integration",
          label: "Backup size and deletion anomalies fed to SIEM",
          why: "An attacker's first move against backups is deletion or encryption, and the signature is an anomalous size change or an unexpected delete pattern. This is a Level 5 practice; recording the intent now is enough.",
          evidence: "Backup telemetry reaching SIEM with anomaly rules, or a dated plan to do so.",
          conditional: true,
          signals: [["storage", 5], ["observability", 4]],
        },
      ],
    },
    {
      id: "go-dr",
      title: "Disaster recovery",
      intro:
        "The topology here is independent-cluster: each cluster is self-contained and recovery means restoring onto a separately provisioned cluster. Stretched clusters are explicitly out of scope.",
      items: [
        {
          id: "kdr-enabled",
          label: "Kasten DR enabled, with cluster ID and passphrase escrowed off-cluster",
          why: "Without Kasten DR, losing the Kasten instance means losing the catalog that makes the exported data restorable. The cluster ID and passphrase are the two facts you cannot recover after the fact, and both live in the cluster you are assuming has gone.",
          evidence:
            "Kasten DR policy present and succeeding; cluster ID and passphrase held in the organisation's secret store with a tested retrieval path.",
          cmd: `kubectl get ${C.CRD.policy} -n ${C.K10_NS} -o name | grep -i 'disaster\\|dr'; echo '--- cluster ID (kasten-io namespace UID) ---'; ${C.K10_CLUSTER_ID}; echo '--- DR secret present? ---'; kubectl get secrets -n ${C.K10_NS} -o name | grep -Ei 'dr-secret|encryption'`,
          blocking: true,
          signals: [["dr", 4]],
        },
        {
          id: "dr-topology-per-tier",
          label: "Cold / warm / export-only topology chosen per workload tier",
          why: "One DR topology for everything either overspends on non-production or under-delivers on the workloads with a real SLA. The choice should fall out of the RPO/RTO table, and the measured restore times from Pre-Production tell you whether the choice is achievable.",
          evidence:
            "The Workload tiers & DR topology panel completed: every tier has an RPO target, an RTO target, a chosen topology, and the measured restore time from Pre-Production alongside it. No unresolved mismatch warnings, or each one explained.",
          blocking: true,
          signals: [["dr", 4]],
        },
        {
          id: "dr-cluster-provisionable",
          label: "The recovery cluster can actually be built",
          why: "A cold-standby plan assumes a cluster can be provisioned on demand. That assumes IaC that still applies, quota in the DR region, images available there, a DNS and ingress plan, and certificates. Each is a routine assumption and each has stopped a real recovery.",
          evidence:
            "The recovery cluster built from IaC at least once in the DR region, with quota, image availability, DNS and certificate issuance confirmed. Record how long it took.",
          blocking: true,
          signals: [["dr", 4]],
        },
        {
          id: "dr-independence",
          label: "The backup control plane does not depend on anything it protects",
          why: "If the Kasten dashboard authenticates against an IdP running on the cluster that just failed, or the passphrase is in a secret store on that cluster, or the restore requires DNS served from it, the recovery path has a circular dependency. This is discovered almost exclusively during real incidents.",
          evidence:
            "A written dependency walk of the recovery path — auth, DNS, secret store, container registry, IaC state — with each dependency confirmed to survive loss of the protected cluster.",
          blocking: true,
          signals: [["dr", 4], ["storage", 4]],
        },
        {
          id: "import-policy-standby",
          label: "Import Policy running on the DR cluster, catalog visible",
          why: "Importing restore points continuously means recovery starts from a populated catalog rather than from an import that must complete first — often the difference between a warm and a cold RTO.",
          evidence: "Import actions completing on the standby cluster on schedule.",
          cmd: `kubectl get ${C.CRD.importAction} -A -o json | jq -r '.items[] | [.metadata.name, (.status.state // "-"), (.status.startTime // "-")] | @tsv' | column -t -s $'\\t'`,
          conditional: true,
          signals: [["dr", 3]],
        },
        {
          id: "runbook-written",
          label: "DR runbook written: sequence, validation, comms and decision authority",
          why: "A runbook that lists commands but not who declares a disaster, who tells the business, and how success is validated leaves the slowest decisions to the worst moment.",
          evidence:
            "A runbook covering: declaration authority, cluster rebuild, restore order, validation per application, comms plan, and a rollback if recovery fails.",
          blocking: true,
          signals: [["people", 3]],
        },
        {
          id: "runbook-executed-by-another",
          label: "Runbook executed successfully by an engineer who did not write it",
          why: "The author cannot test their own runbook — they fill the gaps from memory without noticing. Handing it to a colleague is the only way to find the steps that were never actually written down, and it doubles the number of people who can recover the estate.",
          evidence: "A completed run by a second engineer, with every correction folded back into the document.",
          blocking: true,
          signals: [["people", 4]],
        },
      ],
    },
    {
      id: "go-scale",
      title: "Scale, performance & the backup window",
      items: [
        {
          id: "first-full-window",
          label: "A full production-volume backup cycle completes inside its window",
          why: "POC data volumes tell you nothing about the window. The first month-end at production scale is the wrong time to learn that a full cycle takes eleven hours.",
          evidence: "A complete cycle at production data volume, with the elapsed time inside the agreed window.",
          cmd: C.BACKUP_ACTION_HISTORY,
          blocking: true,
          signals: [["coverage", 3]],
        },
        {
          id: "export-throughput-recorded",
          label: "Export and restore throughput measured",
          why: "Throughput to and from the offsite target is the number that determines real RTO. Restoring 4 TB over a link that sustains 200 Mbps takes about two days regardless of what the DR plan says, and this is the calculation that most often invalidates an RTO commitment.",
          evidence: "Measured MB/s for export and for restore, with the implied recovery time for the largest workload written next to its RTO.",
          cmd: C.RESTORE_DURATIONS,
          blocking: true,
          signals: [["dr", 4]],
        },
        {
          id: "job-concurrency-tuned",
          label: "Job concurrency tuned against measured storage impact",
          why: "Default concurrency is a starting point. Too high and snapshot and export work contends with production I/O; too low and the window is missed. Tune against measurement, not intuition.",
          evidence: "Concurrency settings recorded with the storage latency impact observed during a full cycle.",
          cmd: `${C.K10_HELM_VALUES} -a | grep -Ei 'concurren|worker|limiter' | head -20`,
          signals: [["coverage", 3]],
        },
        {
          id: "k10-resources-sized",
          label: "Kasten requests, limits and catalog volume sized from observed usage",
          why: "Under-requested Kasten pods get evicted under exactly the node pressure a large backup creates, and a full catalog PVC takes the platform down in a way that looks like data loss. Both are visible in advance.",
          evidence: "Requests and limits set from observed usage; catalog PVC utilisation known and the class expandable.",
          cmd: `kubectl get pvc -n ${C.K10_NS}; echo; kubectl top pods -n ${C.K10_NS} 2>/dev/null; echo; kubectl get deploy -n ${C.K10_NS} -o json | jq -r '.items[] | [.metadata.name, ((.spec.template.spec.containers[0].resources.requests // {}) | tostring), ((.spec.template.spec.containers[0].resources.limits // {}) | tostring)] | @tsv' | column -t -s $'\\t'`,
          oc: `oc get pvc -n ${C.K10_NS}; echo; oc adm top pods -n ${C.K10_NS} 2>/dev/null`,
          signals: [["observability", 3]],
        },
        {
          id: "snapshot-retention-controlled",
          label: "Local snapshot retention deliberately low",
          why: "Local snapshots consume primary storage and are not backups. A generous local retention quietly consumes the array and creates pressure that presents as application latency.",
          evidence: "Local retention set to the minimum useful for fast rollback; snapshot count and not-ready count both understood.",
          cmd: `${C.SNAPSHOT_INVENTORY}; echo; ${C.POLICY_SUMMARY}`,
          signals: [["storage", 3]],
        },
      ],
    },
    {
      id: "go-signoff",
      title: "Change control & sign-off",
      intro: "This is the section the exported PDF exists to evidence.",
      items: [
        {
          id: "change-record",
          label: "Change record raised, referencing this checklist export",
          why: "The PDF is the natural artefact for a change record, a go-live gate or an audit evidence pack — that is its job.",
          evidence: "Change record number recorded in the overview notes, with this PDF attached.",
          signals: [["people", 3]],
        },
        {
          id: "rollback-plan",
          label: "Rollback plan for the Kasten rollout itself",
          why: "Deploying a backup platform is a change like any other. Knowing how to back it out without abandoning the restore points it has already created is part of the change, not an afterthought.",
          evidence: "A written backout procedure that preserves the catalog and exported data.",
          signals: [["people", 3]],
        },
        {
          id: "support-path-known",
          label: "Support entitlement, case process and log-bundle procedure known",
          why: "The first time anyone reads the support process should not be during the incident. Generating a log bundle in particular is worth doing once while nothing is wrong.",
          evidence: "Support contract reference, case-raising route, and a log bundle generated once as a dry run.",
          cmd: C.K10_VERSION_INSTALLED,
          signals: [["people", 3]],
        },
        {
          id: "two-operators",
          label: "At least two trained operators",
          why: "A single person who understands the backup platform is a single point of failure in the recovery path, and they will be on leave. It is also the practical route to a second pair of eyes on coverage — and the playbook's Level 3 People descriptor is precisely that more than one person can operate the environment.",
          evidence: "Two named operators who have each independently completed a restore.",
          blocking: true,
          signals: [["people", 3]],
        },
        {
          id: "stakeholder-signoff",
          label: "Sign-off from platform, security/compliance and the workload owner",
          why: "Three parties carry the risk and all three should say yes explicitly. Security owns retention and immutability; the workload owner owns the tolerance for loss; platform owns the operation.",
          evidence: "Three named sign-offs with dates recorded in the overview.",
          blocking: true,
          signals: [["people", 3]],
        },
        {
          id: "maturity-baseline",
          label: "Baseline maturity self-assessment completed and archived with this export",
          why: "Go-live is the natural zero point for the maturity model. Scoring the seven dimensions now means every later reassessment measures a delta rather than starting an argument about where things stood. The maturity signals page of this PDF gives you the evidence to score against.",
          evidence:
            "The companion self-assessment workbook completed for all seven dimensions, with target levels set for the next planning cycle, filed alongside this PDF.",
          blocking: true,
          signals: [["people", 4]],
        },
      ],
    },
  ],
};
