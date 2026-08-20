import type { Stage } from "../checklist-types";
import * as C from "../commands";

/**
 * STAGE 2 — Pre-Production Hardening.
 *
 * Maps to Phase 2 of the 100-day roadmap (Days 15–45, Milestones 4–6).
 *
 * The POC proved recovery is possible. This stage makes it automatic, consistent,
 * offsite, immutable and repeatable by someone other than the person who built it.
 * The shift is from "we restored a thing" to "anything matching a policy is
 * protected whether or not we remember it exists".
 */
export const PREPROD_STAGE: Stage = {
  id: "preprod",
  name: "Pre-Production",
  strapline: "Policy-driven, application-consistent, offsite and immutable",
  roadmapPhase: "Roadmap Phase 2 — Harden the Basics (Days 15–45, M4–M6)",
  playbookRefs: [
    "2.3 Level 3 descriptors",
    "3.3 Policy governance, credential hygiene",
    "4.2 Core components",
    "4.5 Non-functional considerations",
    "5 Roadmap Phase 2",
  ],
  goal:
    "Turn a proven manual restore into automatic coverage: selector-driven policies, quiesced databases, an immutable offsite copy, and restores proven across namespace and cluster boundaries.",
  maturityTarget: "Establishes Level 3 across coverage, app consistency and storage",
  exitCriteria: [
    "New workloads matching a policy selector are protected with no manual step",
    "Immutability is verified at the storage layer, not merely requested in Kasten",
    "A restore into a different namespace and a different cluster has both succeeded",
    "Backup storage credentials cannot delete or bypass the retention lock",
  ],
  sections: [
    {
      id: "pre-policy",
      title: "Policy design & coverage",
      intro:
        "The Playbook is explicit: prefer several labelled policies over one wildcard policy protecting everything. Scope keeps backup windows, retention and application-aware handling appropriate per workload class.",
      items: [
        {
          id: "policy-selector-driven",
          label: "Policies driven by namespace or label selectors",
          why: "Hand-picked workload lists are a coverage gap with a delay fuse: the next namespace someone creates is unprotected and nothing reports it. Selectors make protection the default state.",
          evidence: "Every production policy has a non-empty selector. No policy enumerates individual workloads.",
          cmd: C.POLICY_SUMMARY,
          blocking: true,
          signals: [["coverage", 3]],
        },
        {
          id: "policy-tiering",
          label: "Separate policies per workload tier, with tier-appropriate frequency and retention",
          why: "One policy for everything forces production frequency onto dev volumes and dev retention onto regulated data. Tiering is also what makes the RPO/RTO table real rather than aspirational.",
          evidence:
            "Distinct policies for production / non-production / edge, each with a frequency and retention that matches its tier's documented RPO.",
          cmd: C.POLICY_SUMMARY,
          signals: [["coverage", 3], ["coverage", 4]],
        },
        {
          id: "policy-no-snapshot-only",
          label: "No policy is snapshot-only",
          why: "Re-checked here at fleet scale because it recurs: a policy added in a hurry, or cloned from a test, that never exports. The dashboard shows it succeeding.",
          evidence: "The snapshot-only report returns nothing.",
          cmd: C.POLICIES_WITHOUT_EXPORT,
          blocking: true,
          signals: [["coverage", 3], ["storage", 3]],
        },
        {
          id: "coverage-gap-audit",
          label: "Every namespace holding a PVC is matched by a policy — or excluded on purpose",
          why: "Coverage is the difference between 'Kasten is installed' and 'the data is protected'. The Playbook makes this a governance metric for good reason: it is the number auditors and leadership actually need.",
          evidence:
            "The list of PVC-holding namespaces is fully accounted for by policy selectors. Every unmatched namespace appears on a written exclusion list.",
          cmd: `${C.NAMESPACES_WITH_PVCS}; echo; ${C.POLICY_SUMMARY}`,
          blocking: true,
          signals: [["coverage", 3]],
        },
        {
          id: "exclusions-documented",
          label: "Deliberate exclusions documented",
          why: "Excluding scratch, cache and ephemeral volumes is good practice and cuts cost. Excluding them without writing it down is indistinguishable from missing them.",
          evidence: "A written exclusion list with a reason per entry, reviewed at each coverage audit.",
          signals: [["coverage", 4]],
        },
        {
          id: "backup-window-staggered",
          label: "Schedules staggered against measured job durations",
          why: "Every policy firing at midnight produces storage contention, missed windows and snapshot pressure that looks like a Kasten fault. Stagger against how long jobs actually take, not how long they were assumed to take.",
          evidence: "Start/end times show jobs completing inside their window without overlap on shared storage.",
          cmd: C.BACKUP_ACTION_HISTORY,
          signals: [["coverage", 3]],
        },
        {
          id: "policy-paused-none",
          label: "No policy left paused",
          why: "Pausing a policy to debug something is normal. Forgetting to unpause it is the quietest possible way to stop protecting a workload — no failure, no alert, no job.",
          evidence: "The paused-policy report returns nothing.",
          cmd: C.POLICIES_PAUSED,
          signals: [["coverage", 3]],
        },
        {
          id: "kubevirt-vms",
          label: "KubeVirt / OpenShift Virtualization VMs protected",
          why: "VM workloads on Kubernetes need their own consideration and are easy to miss when the mental model is 'containers with PVCs'.",
          evidence: "VirtualMachine resources are covered by a policy, or the cluster runs none.",
          cmd: `kubectl get virtualmachines.kubevirt.io -A 2>/dev/null || echo 'No KubeVirt CRDs — mark N/A'`,
          conditional: true,
          signals: [["coverage", 3]],
        },
      ],
    },
    {
      id: "pre-appconsistency",
      title: "Application consistency",
      intro:
        "Crash-consistent snapshots are not reliable for transactional databases. This section is what makes a restored database start rather than recover.",
      items: [
        {
          id: "blueprints-deployed",
          label: "Blueprints and BlueprintBindings in place for every data service",
          why: "Without a Blueprint, a database snapshot captures whatever was on disk mid-transaction. It usually starts. 'Usually' is not a recovery guarantee, and the failure surfaces at restore time — the worst possible moment to discover it.",
          evidence: "A Blueprint plus binding for each engine identified during the POC.",
          cmd: `kubectl get ${C.CRD.blueprint} -n ${C.K10_NS}; echo; kubectl get ${C.CRD.blueprintBinding} -n ${C.K10_NS} -o yaml | grep -E 'name:|blueprint:|selector:|matchLabels:' `,
          blocking: true,
          signals: [["appconsistency", 3]],
        },
        {
          id: "sidecar-injection",
          label: "Kanister sidecar injection enabled and permitted by admission policy",
          why: "Sidecar injection is how quiescing reaches the workload. If PSA or an SCC blocks it, the Blueprint silently does not apply and the backup falls back to crash-consistent — while still reporting success.",
          evidence: "Injection configured in the Helm values and confirmed present on a running data-service pod.",
          cmd: `${C.K10_HELM_VALUES} -a | grep -Ei 'injectKanisterSidecar|sidecar' ; echo; kubectl get pods -A -o json | jq -r '.items[] | select((.spec.containers // []) | map(.name) | index("kanister-sidecar")) | [.metadata.namespace, .metadata.name] | @tsv'`,
          signals: [["appconsistency", 3]],
        },
        {
          id: "blueprint-restore-validated",
          label: "Quiescing validated by restoring and running the engine's own consistency check",
          why: "Backup success proves the Blueprint ran, not that it produced a consistent image. The only real test is a restore followed by the database's own integrity check — `pg_amcheck`, `mysqlcheck`, `db.validate()` or equivalent.",
          evidence: "A restore per engine, with the consistency check output attached and clean.",
          cmd: C.RESTORE_DURATIONS,
          blocking: true,
          signals: [["appconsistency", 4], ["people", 3]],
        },
        {
          id: "logical-dump-fallback",
          label: "Fallback path documented for engines without a Blueprint",
          why: "Some workloads will not have a supported Blueprint. A documented logical-dump-into-a-PVC pattern is a legitimate answer; discovering the gap during an incident is not.",
          evidence: "Named workloads with a written fallback procedure, or none applicable.",
          conditional: true,
          signals: [["appconsistency", 4]],
        },
      ],
    },
    {
      id: "pre-target",
      title: "Backup target, immutability & credentials",
      intro:
        "Treat backup data as a ransomware target, not as a byproduct of backup. Everything here assumes the attacker already has cluster-admin.",
      items: [
        {
          id: "offsite-target",
          label: "Exports land offsite, in a failure domain independent of the cluster",
          why: "A copy in the same datacentre, on the same storage array, or in the same cloud account and region as the cluster shares the failure it is supposed to survive.",
          evidence: "Target location recorded, with an explicit statement of which failure domain it does not share.",
          cmd: C.PROFILE_SUMMARY,
          blocking: true,
          signals: [["storage", 3]],
        },
        {
          id: "immutability-verified-at-storage",
          label: "Immutability verified at the storage layer, not just requested in Kasten",
          why: "A protection period configured in Kasten and a bucket without Object Lock enabled look the same from the dashboard. Only the storage layer can tell you whether a delete would actually be refused — and that is the question ransomware asks.",
          evidence:
            "Object Lock (or Blob immutability, or a Hardened Repository) confirmed by querying the storage provider directly, plus versioning enabled where the provider requires it.",
          cmd: `${C.PROFILE_SUMMARY}; echo '--- verify at the storage layer (substitute your bucket) ---'; ${C.OBJECT_LOCK_CHECK}`,
          blocking: true,
          signals: [["storage", 3], ["storage", 4]],
        },
        {
          id: "retention-vs-lock",
          label: "Lock retention and Kasten retention agree, and lifecycle rules do not fight them",
          why: "If Kasten's retention is shorter than the lock period, expiry attempts fail and the catalog fills with objects it cannot remove. If a lifecycle rule transitions or expires objects the lock protects, the two systems argue and one of them loses your restore point.",
          evidence: "Retention schedule, Object Lock period and lifecycle rules written side by side and reconciled.",
          cmd: C.POLICY_SUMMARY,
          signals: [["storage", 4], ["observability", 4]],
        },
        {
          id: "credential-separation",
          label: "Backup storage credentials distinct from cluster credentials",
          why: "The Playbook's rule: a compromised cluster credential must never be sufficient to reach, alter or delete the backup archive. If the cluster's instance role can write to the bucket, one compromise takes both copies.",
          evidence: "A dedicated identity for backup storage, least-privilege, with a named owner and a rotation schedule independent of cluster credentials.",
          cmd: C.K10_SECRET_NAMES,
          blocking: true,
          signals: [["storage", 3]],
        },
        {
          id: "no-lock-bypass",
          label: "The backup identity cannot bypass or shorten the retention lock",
          why: "Object Lock in governance mode with `s3:BypassGovernanceRetention` granted is not immutability — it is a speed bump with a documented API call. Check the policy attached to the identity Kasten uses, not the bucket's advertised capability.",
          evidence:
            "The backup identity's policy grants no bypass permission, no ability to change the lock configuration, and no bucket-policy or lifecycle write access. Compliance mode where the retention requirement is regulatory.",
          blocking: true,
          signals: [["storage", 4]],
        },
        {
          id: "multiple-profiles",
          label: "More than one Location Profile — the 3-2-1 rule satisfied",
          why: "Three copies: the live volume, a local or regional object copy, and a cross-region or off-site copy. One export target satisfies two of the three.",
          evidence: "At least two Location Profiles in different regions or providers, both validating.",
          cmd: C.PROFILE_SUMMARY,
          signals: [["storage", 3]],
        },
        {
          id: "encryption-byok",
          label: "Encryption in transit and at rest, with customer-managed keys where required",
          why: "Regulated workloads frequently require key custody, and retrofitting BYOK/CMEK after the archive is populated is considerably more work than configuring it first.",
          evidence: "TLS to the target confirmed, at-rest encryption confirmed, key custody recorded per workload tier.",
          conditional: true,
          signals: [["storage", 4]],
        },
        {
          id: "key-recovery-drill",
          label: "A restore performed using only the escrowed passphrase",
          why: "Escrow that has never been used is a filing decision, not a recovery capability. Retrieving the passphrase through the documented procedure — by someone who does not already know it — is what proves the escrow works.",
          evidence:
            "A restore completed by an engineer who obtained the passphrase solely through the documented retrieval procedure, with the elapsed retrieval time recorded.",
          signals: [["people", 4], ["dr", 4]],
        },
      ],
    },
    {
      id: "pre-identity",
      title: "Identity, RBAC & exposure",
      items: [
        {
          id: "oidc-integrated",
          label: "Dashboard authentication integrated with the enterprise identity provider",
          why: "A shared token in a wiki page is an audit finding and a real risk: whoever holds it can delete every restore point. Group-based access also means leavers lose access without anyone remembering to act.",
          evidence: "OIDC / OpenShift Auth / LDAP configured; no shared static token in use.",
          cmd: `${C.K10_HELM_VALUES} -a | grep -Ei 'auth|oidc|ldap|dex|token' | head -30`,
          blocking: true,
          signals: [["central", 3]],
        },
        {
          id: "rbac-scoped",
          label: "Kasten roles bound to groups, with namespace-scoped roles for application teams",
          why: "Backup admin is a powerful role — it can read every volume in the cluster and destroy every restore point. Individual bindings drift; group bindings follow joiners and leavers.",
          evidence: "Bindings reference groups. Application teams hold namespace-scoped roles, not cluster-wide admin.",
          cmd: C.K10_RBAC,
          signals: [["central", 3]],
        },
        {
          id: "dashboard-exposure-controlled",
          label: "If exposed, the dashboard has TLS, authentication and restricted source ranges",
          why: "The default install is ClusterIP-only by design. Adding an Ingress without auth publishes a console that can read and delete backups, and it will be found.",
          evidence: "No Ingress/Route, or one with TLS, enforced authentication and a source-range restriction.",
          cmd: `kubectl get ingress -n ${C.K10_NS} -o yaml | grep -E 'host:|tls:|secretName:|annotations:' `,
          oc: `oc get route -n ${C.K10_NS} -o custom-columns='NAME:.metadata.name,HOST:.spec.host,TLS:.spec.tls.termination'`,
          signals: [["central", 3]],
        },
      ],
    },
    {
      id: "pre-central",
      title: "Centralized management",
      intro: "Mark this section N/A for a genuinely single-cluster estate — but confirm that is still true.",
      items: [
        {
          id: "mcm-deployed",
          label: "Multi-Cluster Manager deployed and clusters joined",
          why: "Per-cluster configuration drifts the moment there is more than one cluster, and drift in backup configuration is invisible until a restore. Central policy is also the only practical way to answer 'is the whole fleet protected'.",
          evidence: "Primary instance promoted, clusters joined and visible, certificates trusted.",
          cmd: C.MCM_DISCOVERY,
          conditional: true,
          signals: [["central", 3]],
        },
        {
          id: "global-policies",
          label: "Global Policies and Global Profiles distributing configuration",
          why: "Defining policy once and distributing it is what makes fleet-wide standards enforceable rather than aspirational — and what makes edge sites viable without per-site work.",
          evidence: "Global policies and profiles present, with per-cluster overrides deliberate and documented.",
          conditional: true,
          signals: [["central", 3], ["coverage", 4]],
        },
        {
          id: "licence-entitlement",
          label: "Licence entitlement checked against node count",
          why: "Kasten licensing keys off node count. Finding an entitlement shortfall during a production incident, or at renewal with no budget line, are both avoidable.",
          evidence: "Node/worker count recorded against entitlement, with headroom for planned growth.",
          cmd: C.LICENCE_INPUTS,
          signals: [["observability", 4]],
        },
      ],
    },
    {
      id: "pre-restore",
      title: "Restore capability proven beyond the happy path",
      intro:
        "Heterogeneous restore is the primary DR mechanism when the original cluster is gone. These are the restores that actually resemble a disaster.",
      items: [
        {
          id: "restore-alt-namespace",
          label: "Restore into a different namespace proven",
          why: "Namespace-level restore is the everyday recovery case — a bad deploy, a dropped table, a namespace deleted by a broken pipeline. It also surfaces hardcoded namespace references that break silently.",
          evidence: "A restore into a new namespace, with the application verified functional by its owner.",
          cmd: C.RESTORE_DURATIONS,
          blocking: true,
          signals: [["dr", 3]],
        },
        {
          id: "restore-alt-cluster",
          label: "Restore into a different cluster proven",
          why: "This is disaster recovery. Everything else is a restore. It exercises the export path, the credentials, the catalog, and the assumption that the destination cluster's storage classes and versions are compatible — which is where it usually fails first.",
          evidence: "A restore completed on a second cluster via Import Policy or Kasten DR, with the elapsed time recorded.",
          cmd: `kubectl get ${C.CRD.importAction} -A -o json | jq -r '.items[] | [.metadata.namespace, .metadata.name, (.status.state // "-")] | @tsv'; echo; ${C.RESTORE_DURATIONS}`,
          blocking: true,
          signals: [["dr", 3]],
        },
        {
          id: "restore-timed-vs-rto",
          label: "Restore duration measured for the largest workload and compared to the RTO target",
          why: "RTO is a measurement, not a setting. Until the biggest volume has been restored and timed, the RTO in the plan is a guess — and it is usually optimistic by an order of magnitude once egress and rehydration are involved.",
          evidence: "Measured restore duration for the largest workload, next to its RTO target, with the gap acknowledged.",
          cmd: C.RESTORE_DURATIONS,
          blocking: true,
          signals: [["dr", 4], ["people", 4]],
        },
        {
          id: "cluster-scoped-resources",
          label: "Cluster-scoped resources and CRDs the application depends on are covered",
          why: "Namespace backups do not capture CRDs, ClusterRoles, webhooks, StorageClasses or operators. A namespace restored into a cluster missing them produces pods that never start, and the cause is not obvious from the restore log.",
          evidence:
            "Each application's cluster-scoped dependencies listed, and either captured by a cluster-scoped policy or reprovisioned by a tested IaC/GitOps path.",
          cmd: `kubectl get crd -o custom-columns='NAME:.metadata.name,GROUP:.spec.group' | grep -v 'kio.kasten.io\\|kanister.io' | head -40; echo; kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations -o name`,
          blocking: true,
          signals: [["coverage", 3]],
        },
        {
          id: "gitops-interaction",
          label: "GitOps reconcilers will not fight a restore",
          why: "Argo CD or Flux will happily revert a restore mid-flight, or delete resources the restore just created, because the restored state does not match Git. Almost every organisation running GitOps hits this on their first real recovery, and it wastes the first hour of the incident.",
          evidence: "A documented pause/resume procedure for the reconciler, tested as part of a restore.",
          cmd: `kubectl get applications.argoproj.io -A 2>/dev/null | head -20; kubectl get kustomizations.kustomize.toolkit.fluxcd.io,helmreleases.helm.toolkit.fluxcd.io -A 2>/dev/null | head -20; echo 'If neither returns anything, mark N/A'`,
          conditional: true,
          signals: [["people", 3], ["dr", 3]],
        },
        {
          id: "restore-ordering",
          label: "Restore ordering documented for operator-managed and dependent workloads",
          why: "Operators, admission webhooks and services with startup dependencies need a sequence. Restoring a database after the application that expects it produces crash loops that look like data corruption.",
          evidence: "A written restore order per application, exercised at least once.",
          conditional: true,
          signals: [["dr", 4], ["people", 3]],
        },
      ],
    },
  ],
};
