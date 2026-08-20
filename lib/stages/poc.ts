import type { Stage } from "../checklist-types";
import * as C from "../commands";

/**
 * STAGE 1 — Proof of Concept.
 *
 * Maps to Phase 1 of the 100-day roadmap (Days 1–14, Milestones 1–3).
 *
 * The question this stage answers is narrow and it is not "does Kasten install":
 * it is "can we get this environment's data back". Everything here exists to
 * reach one gate — a restore from an *exported* restore point of a workload that
 * resembles something the business actually runs.
 */
export const POC_STAGE: Stage = {
  id: "poc",
  name: "Proof of Concept",
  strapline: "Prove recovery works here, on something representative",
  roadmapPhase: "Roadmap Phase 1 — Foundation (Days 1–14, M1–M3)",
  playbookRefs: [
    "2.3 Level 1–2 descriptors",
    "4.1 Architecture principles",
    "4.6 Data protection principles",
    "5 Roadmap Phase 1",
  ],
  goal:
    "Demonstrate that a representative workload in this environment can be snapshotted, exported off-cluster, and restored — and record every gap found on the way.",
  maturityTarget: "Clears Level 1, establishes Level 2",
  exitCriteria: [
    "A representative workload has been restored from an exported restore point, not just from a local snapshot",
    "The K10 encryption passphrase is escrowed outside the cluster",
    "Every gap found during the POC is written down with an owner and a target stage",
  ],
  sections: [
    {
      id: "poc-scope",
      title: "Scope & success criteria",
      intro:
        "A POC that has not defined what success means cannot fail, which is why it so often ends in a stalled deal or a production deployment nobody signed off. Agree these four things in writing before touching a cluster.",
      items: [
        {
          id: "poc-scope-defined",
          label: "POC scope, timebox and exit criteria agreed in writing",
          why: "An open-ended POC drifts into being production without anyone deciding it should. A written exit criterion is what converts 'it seems to work' into a decision.",
          evidence:
            "A one-page scope: which namespaces, which workloads, what must be demonstrated, by when, and who accepts it.",
          blocking: true,
          signals: [["people", 1]],
        },
        {
          id: "poc-owner-named",
          label: "Named technical owner and business sponsor",
          why: "Backup ownership defaults to nobody. The Resilience Playbook's minimum responsibility model needs a platform owner and a workload owner named on day one, not after the first failure.",
          evidence: "Two names recorded in the overview notes — one accountable for the platform, one for the data.",
          signals: [["people", 2]],
        },
        {
          id: "poc-workload-representative",
          label: "POC workload is representative of production",
          why: "A POC against a stateless demo app proves nothing about recovering the estate. It needs a real database, a real PVC, the same StorageClass production uses, and a realistic data volume — otherwise every hard problem is deferred to go-live week.",
          evidence:
            "The POC namespace contains at least one stateful data service, on the same StorageClass and volume mode as the intended production workloads.",
          cmd: C.NAMESPACES_WITH_PVCS,
          blocking: true,
          signals: [["coverage", 1]],
        },
        {
          id: "poc-rpo-rto-draft",
          label: "Draft RPO/RTO recorded per workload tier",
          why: "Requirements drive the architecture, not the other way around. Even rough numbers change the POC: an RPO of 15 minutes and an RPO of 24 hours are different products.",
          evidence:
            "Production / non-production / edge tiers each with a target RPO and RTO in the overview notes, however approximate.",
          signals: [["dr", 2], ["people", 2]],
        },
        {
          id: "poc-inventory",
          label: "Workload and data footprint inventory captured",
          why: "Milestone 1 sizing input, and the baseline every later coverage audit is measured against. Also the first honest answer to 'how much are we about to back up'.",
          evidence: "PVC count, provisioned capacity, namespace count, and an estimate of daily change rate.",
          cmd: C.PVC_FOOTPRINT,
          signals: [["coverage", 1]],
        },
      ],
    },
    {
      id: "poc-platform",
      title: "Platform prerequisites",
      intro:
        "Run these before installing anything. Most POC failures are platform facts that were true before Kasten arrived.",
      items: [
        {
          id: "k8s-version-supported",
          label: "Kubernetes version within the supported range",
          why: "Support boundaries change with each Kasten release, and an unsupported version turns every subsequent finding into a question about the version.",
          evidence:
            "Server version inside the supported range for the Kasten release you intend to install. Note the client/server skew too.",
          cmd: C.K8S_VERSION,
          blocking: true,
          signals: [],
          docs: [
            { label: "Kasten system requirements", url: "https://docs.kasten.io/latest/install/requirements.html" },
          ],
        },
        {
          id: "nodes-healthy",
          label: "All nodes Ready, with version skew and zone spread recorded",
          why: "Node readiness is table stakes; the zone and architecture columns are the ones that matter later. A cluster whose nodes all sit in one zone has a DR conversation coming, and mixed arm64/amd64 nodes change image and restore-target assumptions.",
          evidence: "Every node Ready. Record how many zones are represented and whether the control plane is HA.",
          cmd: C.NODE_SUMMARY,
          signals: [["dr", 1]],
        },
        {
          id: "metrics-api-available",
          label: "Metrics API available",
          why: "Without the metrics API, `kubectl top` returns nothing and neither sizing nor backup-window impact can be measured. Cheaper to find now than during the first production backup.",
          evidence: "`v1beta1.metrics.k8s.io` present and Available=True.",
          cmd: C.METRICS_API,
          signals: [["observability", 1]],
        },
        {
          id: "headroom-for-backup",
          label: "CPU and memory headroom for the backup window",
          why: "Snapshot and export work is not free. A cluster already at 90% allocation will show backup jobs as the cause of pressure they merely revealed.",
          evidence: "Node utilisation with enough headroom that concurrent export jobs will not evict workloads.",
          cmd: `kubectl top nodes; kubectl describe nodes | grep -A6 'Allocated resources'`,
          oc: `oc adm top nodes; oc describe nodes | grep -A6 'Allocated resources'`,
          signals: [],
        },
        {
          id: "psa-scc-compatible",
          label: "Pod Security Admission / SCC permits Kasten and Kanister sidecars",
          why: "A `restricted` PSA label on an application namespace, or a tight SCC on OpenShift, silently blocks Kanister sidecar injection — so application-consistent backup fails later for reasons that look nothing like a backup problem.",
          evidence:
            "Enforce level recorded for kasten-io and every application namespace in scope; any exception needed is identified now.",
          cmd: C.PSA_LABELS,
          oc: `oc get scc -o custom-columns='NAME:.metadata.name,PRIV:.allowPrivilegedContainer,RUNASUSER:.runAsUser.type,FSGROUP:.fsGroup.type'; ${C.PSA_LABELS.replace(/\bkubectl\b/g, "oc")}`,
          signals: [["appconsistency", 1]],
        },
        {
          id: "image-pull-path",
          label: "Container images pullable (registry or mirror reachable)",
          why: "Air-gapped and proxied clusters need a mirror configured before install, and image pull failures elsewhere in the cluster are an early warning that yours will fail too.",
          evidence: "No ImagePullBackOff/ErrImagePull anywhere, or a documented registry mirror for the Kasten images.",
          cmd: C.UNHEALTHY_PODS,
          signals: [],
        },
      ],
    },
    {
      id: "poc-storage",
      title: "Storage & snapshot capability",
      intro:
        "This section is where POCs are quietly won or lost. Kasten's efficient path depends on CSI snapshots; everything else is a fallback with different performance and consistency characteristics.",
      items: [
        {
          id: "csi-snapshot-stack",
          label: "Snapshot CRDs installed and a snapshot controller running",
          why: "VolumeSnapshot CRDs and the external-snapshotter controller are cluster prerequisites that Kasten does not install. Without them there is no CSI snapshot path at all.",
          evidence: "The snapshot.storage.k8s.io API group resolves and a snapshot-controller Deployment exists and is ready.",
          cmd: C.SNAPSHOT_STACK,
          blocking: true,
          signals: [["storage", 1]],
        },
        {
          id: "storageclass-inventory",
          label: "StorageClass inventory captured, with default and expansion flags",
          why: "The default class decides where restores land when a manifest omits one. `allowVolumeExpansion` decides whether a restore into a slightly larger volume is possible. Both are restore-time facts worth knowing before the restore.",
          evidence: "Every StorageClass listed with provisioner, default annotation, reclaim policy, expansion and binding mode.",
          cmd: C.STORAGECLASS_SUMMARY,
          signals: [["storage", 1]],
        },
        {
          id: "vsc-annotated",
          label: "VolumeSnapshotClass annotated for Kasten, for every driver in use",
          why: "Kasten selects a snapshot class by the `k10.kasten.io/is-snapshot-class: \"true\"` annotation. One annotated class covering one driver is a common POC state that breaks the moment a second storage backend appears.",
          evidence: "Each CSI driver in use has an annotated VolumeSnapshotClass. Record the deletion policy for each.",
          cmd: C.VSC_SUMMARY,
          blocking: true,
          signals: [["storage", 1]],
          docs: [
            { label: "Kasten install checklist", url: "https://docs.kasten.io/latest/install/checklist.html" },
          ],
        },
        {
          id: "pvc-to-vsc-coverage",
          label: "Every provisioner in active use has a matching VolumeSnapshotClass",
          why: "This is the single most common POC-to-production surprise. Workloads on a provisioner with no snapshot class fall back to a generic file-level copy: slower, heavier on the running pod, and with different consistency behaviour from the path that was tested. It is also invisible until someone compares the two lists.",
          evidence:
            "The list of provisioners backing real PVCs is a subset of the list of drivers with a VolumeSnapshotClass. Any provisioner in the first list and not the second is an accepted-risk decision, in writing.",
          cmd: C.SC_WITHOUT_SNAPSHOT_CLASS,
          blocking: true,
          signals: [["storage", 2], ["coverage", 2]],
        },
        {
          id: "snapshot-roundtrip",
          label: "Manual snapshot and restore proven at the storage layer",
          why: "Creating a VolumeSnapshot by hand and provisioning a new PVC from it separates storage problems from Kasten problems. Do it once, before install, and every later failure has a shorter list of suspects.",
          evidence:
            "A VolumeSnapshot reaches readyToUse=true and a PVC created with it as dataSource binds. Performed via your own change process, not from this checklist.",
          cmd: C.SNAPSHOT_INVENTORY,
          signals: [["storage", 1]],
        },
      ],
    },
    {
      id: "poc-install",
      title: "Install & access",
      items: [
        {
          id: "install-method-recorded",
          label: "Install method chosen and recorded, with rationale",
          why: "Helm gives immediate access to new releases; Marketplace/Operator simplifies lifecycle but can lag releases by days while the vendor validates. That trade-off should be a decision, not an accident, because it determines how quickly you can take a fix.",
          evidence: "Chart or operator version installed, and a note of why that method was chosen.",
          cmd: C.K10_VERSION_INSTALLED,
          signals: [["central", 1]],
        },
        {
          id: "helm-values-captured",
          label: "Install-time values captured and stored in version control",
          why: "This output is the authoritative record of auth mode, FIPS, encryption settings, ingress, resource overrides and sidecar injection. A DR-time reinstall that silently differs from the original is its own outage — and support's first question is always what you installed with.",
          evidence: "`helm get values` output committed alongside your infrastructure code, not pasted in a ticket.",
          cmd: `${C.K10_HELM_VALUES}; echo '--- including defaults ---'; ${C.K10_HELM_VALUES} -a`,
          signals: [["central", 2], ["people", 2]],
        },
        {
          id: "k10-pods-healthy",
          label: "Kasten pods healthy, with restart counts checked",
          why: "A pod that is Running today but has restarted forty times is an unresolved resource or configuration problem waiting for the busiest backup window to reappear. Phase alone hides it.",
          evidence: "No pods outside Running, and restart counts at or near zero. Investigate anything non-zero.",
          cmd: C.K10_POD_HEALTH,
          signals: [],
        },
        {
          id: "primer-clean",
          label: "Pre-flight primer run and every warning resolved",
          why: "The primer checks exactly the prerequisites that cause silent failures later — snapshot classes, CSI capability, RBAC. Warnings deferred at POC become go-live blockers found under time pressure.",
          evidence: "Primer output attached, with each warning either fixed or accepted in writing.",
          cmd: `curl -s https://docs.kasten.io/downloads/latest/tools/k10_primer.sh | bash`,
          signals: [["storage", 1]],
        },
        {
          id: "dashboard-reachable",
          label: "Dashboard reachable — via port-forward at this stage",
          why: "Getting to the dashboard proves the gateway and auth path work. Doing it over port-forward rather than a public Ingress keeps an unauthenticated backup console off the network while the install is still being shaped.",
          evidence: "Dashboard loads. No Ingress or Route exposing it publicly yet.",
          cmd: `kubectl get svc,ingress -n ${C.K10_NS}`,
          oc: `oc get svc,route -n ${C.K10_NS}`,
          signals: [],
        },
        {
          id: "auth-mode-chosen",
          label: "Authentication mode chosen, with the production mode identified",
          why: "Token or basic auth is fine for a two-week POC and is not fine for production. Deciding now which mode production will use — OpenShift Auth, OIDC, LDAP — prevents a reinstall later, since some auth settings are install-time.",
          evidence: "Current mode visible in the Helm values, and the intended production mode recorded.",
          cmd: `${C.K10_HELM_VALUES} | grep -Ei 'auth|oidc|ldap|token|dex' || echo 'no auth overrides — running install default'`,
          signals: [["central", 2]],
        },
        {
          id: "encryption-key-escrowed",
          label: "Encryption passphrase escrowed outside the cluster",
          why: "Lose this and the backups are unreadable — permanently, including by Veeam. It is the one item on this checklist with no recovery path, and it is most often skipped at POC because the POC 'does not matter yet'. The POC's backups do not matter; the habit does.",
          evidence:
            "The passphrase is in the organisation's secret store or physical escrow, outside this cluster, with a documented retrieval procedure and at least two people able to retrieve it.",
          cmd: `kubectl get secrets -n ${C.K10_NS} -o name | grep -Ei 'encryption|passphrase|dr-secret'`,
          blocking: true,
          signals: [["storage", 2], ["people", 2]],
        },
      ],
    },
    {
      id: "poc-firstprotect",
      title: "First protection & first restore — the POC gate",
      intro:
        "Nothing in this section is optional and none of it can be inferred from a green dashboard. The Resilience Playbook is blunt about it: a backup that has never been restored is not a backup.",
      items: [
        {
          id: "location-profile-validated",
          label: "At least one Location Profile configured and validating successfully",
          why: "Snapshots stay on the storage that holds the volume. Without a validated export target there is no copy that survives the loss of that storage, so there is no backup — only a faster undo.",
          evidence: "Profile present with validation Success, and the bucket or repository recorded.",
          cmd: C.PROFILE_SUMMARY,
          blocking: true,
          signals: [["storage", 2]],
        },
        {
          id: "first-policy-exports",
          label: "First policy performs both snapshot and export",
          why: "A snapshot-only policy is the most common misconfiguration in the field and it looks identical to a working one on the dashboard. Check the action list, not the green tick.",
          evidence: "The policy's action list contains `export`, targeting the validated Location Profile.",
          cmd: `${C.POLICY_SUMMARY}; echo; ${C.POLICIES_WITHOUT_EXPORT}`,
          blocking: true,
          signals: [["coverage", 2], ["storage", 2]],
        },
        {
          id: "first-backup-clean",
          label: "First backup and export complete with no warnings",
          why: "Warnings at POC scale become failures at production scale. A partially-skipped volume is a warning, and a warning that nobody read is how a workload ends up unprotected for months.",
          evidence: "Backup and export actions in state Complete. Zero warnings — investigate, do not accept, any that appear.",
          cmd: `${C.BACKUP_ACTION_HISTORY}; echo; ${C.ACTIONS_NOT_COMPLETE}`,
          blocking: true,
          signals: [["coverage", 2]],
        },
        {
          id: "first-restore-inplace",
          label: "Restore proven in the original namespace",
          why: "The first restore, on a non-critical workload. Minutes of work that prevents days of pain, and the step that separates Level 1 from Level 2 more decisively than any product feature.",
          evidence: "A RestoreAction in state Complete, and the application verified working by whoever owns it — not just Running.",
          cmd: C.RESTORE_DURATIONS,
          blocking: true,
          signals: [["people", 2], ["dr", 2]],
        },
        {
          id: "restore-from-export",
          label: "Restore proven from an exported restore point, with local snapshots unavailable",
          why: "Restoring from a local snapshot exercises none of the machinery a real incident needs. In a genuine failure the local snapshot is gone with the storage — the exported copy is what you will have. Prove that path now, deliberately, while it is cheap to discover that credentials, network egress or the immutability configuration prevent it.",
          evidence:
            "A restore completed sourced from the exported restore point in the Location Profile, with the corresponding local snapshot removed or excluded. Record the duration: this is your first real RTO data point.",
          cmd: C.RESTORE_DURATIONS,
          blocking: true,
          signals: [["dr", 2], ["storage", 2], ["people", 2]],
        },
        {
          id: "app-consistency-candidates",
          label: "Workloads needing application-consistent backup identified",
          why: "Crash-consistent snapshots are not reliable for transactional databases. Discovering which engines are actually running — from the images, not from memory — is the input to the Blueprint work in the next stage.",
          evidence: "A list of data services in scope, each marked as needing a Blueprint, a logical dump, or nothing.",
          cmd: C.DATA_SERVICE_DISCOVERY,
          // Level 2 of Application Consistency in the playbook is precisely
          // "awareness of which workloads need application-aware handling, but
          // Blueprints not yet broadly applied" — which is what this item is.
          signals: [["appconsistency", 2]],
        },
        {
          id: "poc-findings-logged",
          label: "Every POC finding logged with an owner and a target stage",
          why: "POC findings are the pre-production backlog. Unwritten, they are rediscovered at go-live by someone under pressure who does not know they were already understood.",
          evidence: "A gap list carried into the Pre-Production stage, each entry with an owner and a due stage.",
          blocking: true,
          signals: [["people", 2]],
        },
      ],
    },
  ],
};
