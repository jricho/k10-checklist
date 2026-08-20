// Reusable command fragments.
//
// Two rules for everything in this file:
//
//  1. READ-ONLY. Nothing here mutates cluster state. A customer must be able to
//     paste any of these into a production shell during a call without thinking
//     about it. Items that require a mutating action (create a VolumeSnapshot,
//     run a restore) say so in prose and are performed from the K10 UI or by the
//     customer's own change process — they are not offered as copy-paste.
//
//  2. FULLY-QUALIFIED CRDs. Always `policies.config.kio.kasten.io`, never
//     `policies`. Short names collide: Kyverno, Calico, Gatekeeper and several
//     service meshes all register something called `policies`, so the short form
//     silently queries the wrong API group on exactly the busy, mature clusters
//     where being wrong matters most.
//
// Tooling assumed on the operator's workstation: kubectl (or oc), jq, helm.
// Where a K10 CRD field path could move between releases, the command uses jq's
// `//` fallback or a `grep` over YAML so that it degrades to "field not found"
// rather than printing a confidently blank column.

export const K10_NS = "kasten-io";

/** Fully-qualified resource names for every CRD the checklist touches. */
export const CRD = {
  policy: "policies.config.kio.kasten.io",
  profile: "profiles.config.kio.kasten.io",
  blueprintBinding: "blueprintbindings.config.kio.kasten.io",
  blueprint: "blueprints.cr.kanister.io",
  backupAction: "backupactions.actions.kio.kasten.io",
  exportAction: "exportactions.actions.kio.kasten.io",
  importAction: "importactions.actions.kio.kasten.io",
  restoreAction: "restoreactions.actions.kio.kasten.io",
  application: "applications.apps.kio.kasten.io",
  volumeSnapshot: "volumesnapshots.snapshot.storage.k8s.io",
  volumeSnapshotClass: "volumesnapshotclasses.snapshot.storage.k8s.io",
  volumeSnapshotContent: "volumesnapshotcontents.snapshot.storage.k8s.io",
} as const;

/**
 * Policy summary: name, schedule, which actions the policy performs, retention,
 * selector and paused state — in one row per policy.
 *
 * This one command answers four separate checklist questions, which is the point:
 * `kubectl get policies` tells you a policy exists; this tells you whether it
 * exports, what it keeps, what it selects, and whether someone left it paused.
 */
export const POLICY_SUMMARY = `kubectl get ${CRD.policy} -n ${K10_NS} -o json | jq -r '.items[] | [.metadata.name, (.spec.frequency // "-"), ((.spec.actions // []) | map(.action) | join("+")), ((.spec.retention // {}) | tostring), ((.spec.selector // {}) | tostring), ((.spec.paused // false) | tostring)] | @tsv' | column -t -s $'\\t'`;

/**
 * Policies that snapshot but never export. The single most common reason a
 * customer who "has backups" discovers during a real incident that they do not:
 * a local CSI snapshot lives on the same storage as the volume it protects and
 * dies with it.
 */
export const POLICIES_WITHOUT_EXPORT = `kubectl get ${CRD.policy} -n ${K10_NS} -o json | jq -r '.items[] | select(((.spec.actions // []) | map(.action) | index("export")) == null) | "SNAPSHOT-ONLY: " + .metadata.name'`;

/** Any policy left paused — usually a forgotten debugging step. */
export const POLICIES_PAUSED = `kubectl get ${CRD.policy} -n ${K10_NS} -o json | jq -r '.items[] | select(.spec.paused == true) | "PAUSED: " + .metadata.name'`;

/**
 * Location Profiles with their validation state and, where present, the
 * immutability protection period. Field paths under `locationSpec` vary by
 * target type, so this prints the whole locationSpec when the expected keys are
 * absent instead of pretending there is nothing there.
 */
export const PROFILE_SUMMARY = `kubectl get ${CRD.profile} -n ${K10_NS} -o json | jq -r '.items[] | [.metadata.name, (.spec.type // "-"), (.spec.locationSpec.objectStore.objectStoreType // "see-locationSpec"), (.spec.locationSpec.objectStore.bucket // "-"), (.spec.locationSpec.objectStore.protectionPeriod // "NO-IMMUTABILITY-SET"), (.status.validation // "-")] | @tsv' | column -t -s $'\\t'`;

/** Fallback for the above when a field path has moved: read the YAML directly. */
export const PROFILE_RAW = `kubectl get ${CRD.profile} -n ${K10_NS} -o yaml | grep -Ei 'name:|type:|bucket:|region:|endpoint:|protectionPeriod|immutab|validation'`;

/**
 * Backup action outcomes, newest last, with duration. Duration is the number
 * that tells you whether the backup window is holding as data grows.
 */
export const BACKUP_ACTION_HISTORY = `kubectl get ${CRD.backupAction} -n ${K10_NS} -o json | jq -r '.items | sort_by(.metadata.creationTimestamp) | .[-25:] | .[] | [(.metadata.labels["k10.kasten.io/policyName"] // "manual"), .metadata.name, (.status.state // "-"), (.status.startTime // "-"), (.status.endTime // "-")] | @tsv' | column -t -s $'\\t'`;

/** Anything that did not finish cleanly, with the error message. */
export const ACTIONS_NOT_COMPLETE = `for k in ${CRD.backupAction} ${CRD.exportAction} ${CRD.restoreAction} ${CRD.importAction}; do kubectl get "$k" -n ${K10_NS} -o json 2>/dev/null | jq -r --arg k "$k" '.items[] | select(.status.state != "Complete") | [$k, .metadata.name, (.status.state // "-"), (.status.error.message // .status.error // "-")] | @tsv'; done | column -t -s $'\\t'`;

/**
 * Restore durations — measured RTO. Compare against the RTO target recorded in
 * the overview. A restore that has never been timed is not an RTO, it is a hope.
 */
export const RESTORE_DURATIONS = `kubectl get ${CRD.restoreAction} -A -o json | jq -r '.items[] | [.metadata.namespace, .metadata.name, (.status.state // "-"), (.status.startTime // "-"), (.status.endTime // "-")] | @tsv' | column -t -s $'\\t'`;

/**
 * StorageClasses with the attributes that decide whether Kasten can use CSI
 * snapshots, expand a restored volume, or bind it in the right zone.
 */
export const STORAGECLASS_SUMMARY = `kubectl get storageclass -o custom-columns='NAME:.metadata.name,PROVISIONER:.provisioner,DEFAULT:.metadata.annotations.storageclass\\.kubernetes\\.io/is-default-class,RECLAIM:.reclaimPolicy,EXPAND:.allowVolumeExpansion,BINDING:.volumeBindingMode'`;

/** VolumeSnapshotClasses, including the annotation K10 requires. */
export const VSC_SUMMARY = `kubectl get ${CRD.volumeSnapshotClass} -o custom-columns='NAME:.metadata.name,DRIVER:.driver,DELETION:.deletionPolicy,K10-SNAPSHOT-CLASS:.metadata.annotations.k10\\.kasten\\.io/is-snapshot-class'`;

/**
 * The gap that bites at go-live: a StorageClass in active use whose provisioner
 * has no VolumeSnapshotClass. Those workloads fall back to a generic file-level
 * copy — slower, heavier on the running pod, and with different consistency
 * characteristics from the snapshot path everyone tested during the POC.
 */
export const SC_WITHOUT_SNAPSHOT_CLASS = `echo '== provisioners actually in use by PVCs =='; kubectl get pvc -A -o json | jq -r '.items[].spec.storageClassName // empty' | sort -u | while read -r sc; do printf '%s\\t%s\\n' "$sc" "$(kubectl get storageclass "$sc" -o jsonpath='{.provisioner}' 2>/dev/null)"; done; echo '== drivers that have a VolumeSnapshotClass =='; kubectl get ${CRD.volumeSnapshotClass} -o json | jq -r '.items[].driver' | sort -u`;

/**
 * Namespaces holding a PVC — the population that must be matched by a policy
 * selector. Diff this against POLICY_SUMMARY's selectors at every coverage audit;
 * a namespace that appears here and in no policy is an unprotected workload that
 * nobody has decided to leave unprotected.
 */
export const NAMESPACES_WITH_PVCS = `kubectl get pvc -A -o json | jq -r '.items[] | [.metadata.namespace, .metadata.name, (.spec.storageClassName // "none"), (.spec.volumeMode // "Filesystem"), .status.phase, (.spec.resources.requests.storage // "-")] | @tsv' | sort | column -t -s $'\\t'`;

/** Total PVC count and provisioned capacity — the sizing input for Milestone 1. */
export const PVC_FOOTPRINT = `kubectl get pvc -A -o json | jq -r '[.items[] | (.spec.resources.requests.storage // "0") | sub("Gi$";"") | tonumber? // 0] | "PVCs: " + (length | tostring) + "  provisioned(Gi, Gi-denominated claims only): " + (add | tostring)'`;

/**
 * Stateful services that need application-consistent handling, discovered from
 * the images actually running rather than from what anyone remembers deploying.
 */
export const DATA_SERVICE_DISCOVERY = `kubectl get pods -A -o json | jq -r '.items[] | .metadata.namespace as $ns | .spec.containers[] | [$ns, .image] | @tsv' | sort -u | grep -Ei 'postgres|mysql|mariadb|mongo|cassandra|redis|elastic|opensearch|kafka|etcd|clickhouse|couch|neo4j|influx|rabbit'`;

/** K10 pods that are not Running, plus anything that has restarted. */
export const K10_POD_HEALTH = `kubectl get pods -n ${K10_NS} -o json | jq -r '.items[] | (([.status.containerStatuses // [] | .[].restartCount] | add) // 0) as $r | select(.status.phase != "Running" or $r > 0) | [.metadata.name, .status.phase, ("restarts=" + ($r | tostring)), ((.status.containerStatuses // []) | map(select(.ready | not) | .name) | join(",") | if . == "" then "all-ready" else "not-ready:" + . end)] | @tsv' | column -t -s $'\\t'`;

/**
 * Pods stuck in any not-ready state cluster-wide. Replaces
 * `kubectl get pods -A | grep CrashLoopBackOff`, which misses ImagePullBackOff,
 * Init:Error, CreateContainerConfigError and Pending, and which exits non-zero
 * when the cluster is healthy — the one case you want to look like success.
 */
export const UNHEALTHY_PODS = `kubectl get pods -A -o json | jq -r '.items[] | select(.status.phase != "Running" and .status.phase != "Succeeded") | [.metadata.namespace, .metadata.name, .status.phase, (((.status.containerStatuses // []) + (.status.initContainerStatuses // [])) | map(.state.waiting.reason // .state.terminated.reason // empty) | join(",") | if . == "" then "-" else . end)] | @tsv' | column -t -s $'\\t'`;

/**
 * K10 logs. The old `-l app=k10` selector matches nothing: the Helm chart labels
 * pods per component (`app=catalog-svc`, `app=gateway`, ...) with `release=k10`
 * as the common label. Verify the selector on your install with
 * `kubectl get pods -n kasten-io --show-labels`.
 */
export const K10_LOGS = `kubectl logs -n ${K10_NS} --selector=release=k10 --all-containers --prefix --tail=200 --since=24h | grep -Ei 'error|panic|fail|denied|forbidden' | tail -60`;

/** Recent events in the K10 namespace — usually the fastest route to a cause. */
export const K10_EVENTS = `kubectl get events -n ${K10_NS} --sort-by=.lastTimestamp -o custom-columns='LAST:.lastTimestamp,TYPE:.type,REASON:.reason,OBJECT:.involvedObject.name,MESSAGE:.message' | tail -30`;

/**
 * Installed chart and app version, and the install-time values.
 *
 * `helm get values` is the highest-value single command in this checklist: it is
 * the authoritative record of auth mode, FIPS, encryption settings, ingress,
 * resource overrides and sidecar injection. Store its output in version control
 * — a reinstall during a DR event that silently differs from the original is a
 * failure mode all of its own.
 */
export const K10_VERSION_INSTALLED = `helm list -n ${K10_NS} -o json | jq -r '.[] | [.name, .chart, .app_version, .status, .updated] | @tsv' | column -t -s $'\\t'`;
export const K10_HELM_VALUES = `helm get values k10 -n ${K10_NS}`;

/** The K10 cluster ID needed for a K10 DR restore: the namespace UID. */
export const K10_CLUSTER_ID = `kubectl get namespace ${K10_NS} -o jsonpath='{.metadata.uid}'; echo`;

/** Secrets in the K10 namespace, by name only — never dump secret data. */
export const K10_SECRET_NAMES = `kubectl get secrets -n ${K10_NS} -o custom-columns='NAME:.metadata.name,TYPE:.type,AGE:.metadata.creationTimestamp'`;

/** Local snapshot inventory — every one of these consumes primary storage. */
export const SNAPSHOT_INVENTORY = `kubectl get ${CRD.volumeSnapshot} -A -o json | jq -r '"VolumeSnapshots: " + (.items | length | tostring) + "  not-ready: " + ([.items[] | select(.status.readyToUse != true)] | length | tostring)'`;

/** Snapshot contents with no owning VolumeSnapshot — leaked capacity and cost. */
export const ORPHANED_SNAPSHOT_CONTENTS = `kubectl get ${CRD.volumeSnapshotContent} -o json | jq -r '.items[] | select((.spec.volumeSnapshotRef.name // "") == "" or .status.readyToUse != true) | ["ORPHAN-OR-NOT-READY", .metadata.name, (.spec.driver // "-"), ((.status.restoreSize // 0) | tostring)] | @tsv' | column -t -s $'\\t'`;

/** Kubernetes and kubectl versions. `kubectl version --short` was removed in 1.28. */
export const K8S_VERSION = `kubectl version -o json | jq -r '"client: " + .clientVersion.gitVersion + "   server: " + .serverVersion.gitVersion'`;

/** Node health, version skew and failure-domain spread in one table. */
export const NODE_SUMMARY = `kubectl get nodes -o custom-columns='NAME:.metadata.name,READY:.status.conditions[?(@.type=="Ready")].status,KUBELET:.status.nodeInfo.kubeletVersion,OS:.status.nodeInfo.osImage,ARCH:.status.nodeInfo.architecture,ZONE:.metadata.labels.topology\\.kubernetes\\.io/zone,CONTROLPLANE:.metadata.labels.node-role\\.kubernetes\\.io/control-plane'`;

/** Is the metrics API actually available? `kubectl top` is useless without it. */
export const METRICS_API = `kubectl get apiservices v1beta1.metrics.k8s.io -o custom-columns='NAME:.metadata.name,AVAILABLE:.status.conditions[?(@.type=="Available")].status'`;

/** Snapshot CRDs and the external snapshot controller that services them. */
export const SNAPSHOT_STACK = `kubectl api-resources --api-group=snapshot.storage.k8s.io; kubectl get deploy,sts -A -o name | grep -i snapshot-controller`;

/** Pod Security Admission posture on the namespaces that matter. */
export const PSA_LABELS = `kubectl get ns -o custom-columns='NAME:.metadata.name,ENFORCE:.metadata.labels.pod-security\\.kubernetes\\.io/enforce,AUDIT:.metadata.labels.pod-security\\.kubernetes\\.io/audit'`;

/** K10 RBAC bindings — who can administer backups and restores. */
export const K10_RBAC = `kubectl get clusterrolebindings,rolebindings -A -o json | jq -r '.items[] | select((.roleRef.name // "") | test("k10|kasten"; "i")) | [.kind, (.metadata.namespace // "cluster"), .metadata.name, .roleRef.name, ((.subjects // []) | map(.kind + ":" + (.name // "-")) | join(","))] | @tsv' | column -t -s $'\\t'`;

/** Is anything scraping K10, and what metric names exist to alert on? */
export const K10_MONITORING = `kubectl get servicemonitors.monitoring.coreos.com,podmonitors.monitoring.coreos.com -A 2>/dev/null | grep -Ei 'k10|kasten' || echo 'No ServiceMonitor/PodMonitor for K10 — confirm how metrics are scraped'`;
export const K10_METRIC_NAMES = `kubectl -n ${K10_NS} port-forward svc/prometheus-server 9090:80 >/dev/null 2>&1 & sleep 3; curl -s localhost:9090/api/v1/label/__name__/values | jq -r '.data[]' | grep -Ei 'k10|kasten|jobs|action|catalog' | head -40; kill %1`;

/** Multi-Cluster Manager presence, discovered rather than assumed. */
export const MCM_DISCOVERY = `kubectl api-resources --api-group=dist.kio.kasten.io 2>/dev/null; kubectl get deploy -n ${K10_NS} -o name | grep -Ei 'multi|mc-|dist' || echo 'No multi-cluster components found — single-cluster install'`;

/** Node count for licence entitlement checks. */
export const LICENCE_INPUTS = `echo "nodes: $(kubectl get nodes --no-headers | wc -l)  workers: $(kubectl get nodes --no-headers -l '!node-role.kubernetes.io/control-plane' | wc -l)"`;

/** Object Lock verified at the storage layer, not in K10's configuration. */
export const OBJECT_LOCK_CHECK = `aws s3api get-object-lock-configuration --bucket YOUR_BUCKET; aws s3api get-bucket-versioning --bucket YOUR_BUCKET`;
