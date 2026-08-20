# k10-checklist — recommendations

**Scope:** restructure `jricho/k10-checklist` around the customer journey from proof of concept to day-2 operating maturity; deepen the verification commands; tidy the code; and connect the tool to the Kasten Resilience Playbook and the maturity self-assessment workbook.

**Inputs:** the repo at `main` (13 commits), *The Kasten Resilience Playbook*, *Kasten Maturity Self-Assessment.xlsx*, and *Your Path to Resilience with Veeam Kasten* (the 100-day roadmap).

**Decisions taken (per your answers):** stage-gated model with four stages; maturity integration by cross-reference only — the workbook stays the scoring instrument, the checklist supplies evidence; deeper commands, with better items where the existing ones did not earn their place; deliverable is this document plus ready-to-paste code.

---

## 1. Where the current version stands

The app is well built for what it is. The container and Kubernetes packaging is genuinely good — multi-arch, non-root, `restricted-v2`-compatible, pinned release manifests, ClusterIP-only by default, no backend and no cluster access. `app/api/k10-version/route.ts` is careful work: request-time fetch kept off the build path, a hard timeout, and a comment explaining why. That is a higher standard than most internal tools reach.

The content is where it falls short of the documents it is supposed to accompany.

**The journey is missing.** The checklist is a single flat list of 19 items titled "Production Readiness". A customer at day 3 of a POC and a customer at a change board the night before cutover see the same list, so it is wrong for both. It also has no relationship to the 100-day roadmap that the playbook builds its entire maturity mapping on — Phase 1 through Phase 4 do not appear.

**The commands demonstrate existence, not readiness.** `kubectl get pvc --all-namespaces` under "Stateful backup/restore validated" proves that PVCs exist. It says nothing about whether a backup or a restore has been validated, which is what the item claims. Two items share `kubectl get deployments --all-namespaces` for two different assertions. `kubectl get policies -n kasten-io` will happily return Kyverno policies on a cluster that has Kyverno.

**The RAG light can say GO when the environment is not ready.** `percent >= 80` is green. With 19 items, that is 16 of 19 — achievable while "Restore procedures tested" is still unchecked. A readiness gate whose failure mode is a false GO is worse than no gate.

**Everything is in one file.** `app/page.tsx` is 42 KB: checklist data, all UI, and the PDF layout in a single client component. Adding a checklist item means editing the same file as the page-break arithmetic.

---

## 2. Part one — restructuring around the journey

### 2.1 Four stages, each with a gate

| Stage | Roadmap phase | The one question it answers | Items | Blocking |
|---|---|---|---|---|
| **1. Proof of Concept** | Phase 1 — Foundation, Days 1–14 (M1–M3) | Can we get *this* environment's data back? | 30 | 13 |
| **2. Pre-Production** | Phase 2 — Harden the Basics, Days 15–45 (M4–M6) | Is protection automatic, consistent, offsite and immutable? | 32 | 14 |
| **3. Go-Live** | Phase 3 — Optimize & Harden, Days 46–75 (M7–M9) + cutover | Will anyone know when it fails, and can someone else recover it? | 25 | 14 |
| **4. Day-2 Operations** | Phase 4 — Prove Value, Days 76–100 (M10–M12) and beyond | Is maturity being sustained, or quietly decaying? | 25 | 7 |

112 items total. That is a lot more than 19, but it is spread across four stages a customer meets weeks apart, sections are collapsible, and — critically — items can be marked **N/A**, so a single-cluster customer is not permanently penalised for the multi-cluster section.

Stages remain freely browsable. Customers want to read ahead, and an existing customer may open the tool at Day-2. What is gated is the *claim of readiness*, not access to the questions.

### 2.2 The gate replaces the percentage

Blocking items are all-or-nothing and named individually. A stage shows one of:

- **GATE CLEAR** — every blocking item in this stage and all earlier stages passes or is ruled N/A
- **n BLOCKING OPEN** — with the outstanding items listed by name
- **UPSTREAM BLOCKED** — an earlier stage still has an outstanding blocker, so clearing this one proves nothing

The percentage survives as progress reporting only. It never drives the gate.

The blocking proportion (48 of 112, 42%) is a policy decision, not a law — it is one boolean per item in `lib/stages/*.ts`. I set it where I would not personally sign off recovery without the item. Tune it to your field experience; if you want the gate to feel sharper, the first candidates to demote are `poc-inventory`, `exclusions-documented` and `dashboards-published`.

### 2.3 N/A is a first-class answer

The plain checkbox became a three-state control: **Pass / Fail / N/A**, defaulting to pending.

- A checkbox conflates "not looked at yet" with "does not apply to us". The multi-cluster and KubeVirt sections would drag a single-cluster customer's score down forever, and once the number is wrong people stop reading it. N/A leaves the denominator entirely.
- **Fail** is more valuable in an evidence pack than a blank. It records a known, accepted gap at the moment of sign-off rather than an unanswered question. The UI prompts for a note on every N/A and every Fail, and highlights the note field amber until one is written — an unexplained N/A is an audit finding waiting to happen.
- A blocking item marked N/A counts as satisfied. That is what N/A means, and it is exactly why it should be a deliberate, recorded decision.

### 2.4 Items worth calling out

Sixteen additions that, in my reading of the playbook and the roadmap, do the most work. Several are things the current checklist has no equivalent of.

| Item | Stage | Why it earns a place |
|---|---|---|
| **Restore from an exported restore point, with local snapshots unavailable** | POC (blocking) | The current checklist's restore test can be satisfied by restoring from a local snapshot — which exercises almost none of the machinery a real incident needs. In a genuine failure the local snapshot died with the storage. This is the single most valuable addition. |
| Every provisioner in active use has a matching VolumeSnapshotClass | POC (blocking) | The most common POC-to-production surprise. Workloads on an unmatched provisioner silently fall back to generic file-level copy — slower, heavier, different consistency — and nobody notices until go-live. |
| Encryption passphrase escrowed outside the cluster | POC (blocking) | The one item with no recovery path. Usually skipped at POC because "the POC doesn't matter" — the POC's backups don't, the habit does. |
| Install-time Helm values captured into version control | POC | `helm get values` is the authoritative record of auth mode, FIPS, encryption, ingress and sidecar injection. A DR-time reinstall that silently differs from the original is its own outage. |
| PSA / SCC permits Kanister sidecars | POC | A `restricted` namespace label blocks sidecar injection, so application-consistent backup fails later for reasons that look nothing like a backup problem. |
| No policy is snapshot-only | POC + Pre-Prod (blocking) | Looks identical to a working policy on the dashboard. Recurs constantly. |
| Immutability verified **at the storage layer** | Pre-Prod (blocking) | A protection period set in Kasten and a bucket with no Object Lock look the same from the dashboard. Only the storage provider can say whether a delete would be refused. |
| The backup identity cannot bypass the retention lock | Pre-Prod (blocking) | Object Lock in governance mode with `s3:BypassGovernanceRetention` granted is a speed bump with a documented API call, not immutability. |
| Quiescing validated by the engine's own consistency check | Pre-Prod (blocking) | Backup success proves the Blueprint ran, not that the image is consistent. Only a restore plus `pg_amcheck`/`mysqlcheck`/`db.validate()` proves that. |
| A restore performed using only the escrowed passphrase | Pre-Prod | Escrow that has never been used is a filing decision. Retrieval by someone who does not already know the passphrase is what proves it works. |
| Cluster-scoped resources and CRDs covered | Pre-Prod (blocking) | Namespace backups do not capture CRDs, webhooks, ClusterRoles or operators. The restored namespace produces pods that never start and the restore log looks clean. |
| GitOps reconcilers will not fight a restore | Pre-Prod | Argo/Flux will revert a restore mid-flight because restored state does not match Git. Almost every GitOps shop hits this on their first real recovery and loses the first hour of the incident to it. |
| **A deliberately failed job produced a real page or ticket** | Go-Live (blocking) | Alert rules that have never fired are configuration, not coverage. The path from failed export to human has four places to break silently. |
| The backup control plane depends on nothing it protects | Go-Live (blocking) | If auth, DNS, the secret store or IaC state live on the cluster you are recovering, the recovery path is circular. Discovered almost exclusively during real incidents. |
| **Runbook executed by an engineer who did not write it** | Go-Live (blocking) | An author cannot test their own runbook — they fill the gaps from memory. It also doubles the number of people who can recover the estate. |
| Export and restore throughput measured | Go-Live (blocking) | The number that determines real RTO. 4 TB over a link sustaining 200 Mbps is about two days regardless of what the DR plan says. This is what most often invalidates an RTO commitment. |

Day-2 is structured by **cadence** — daily / weekly / monthly / quarterly / annual / pre-renewal — mirroring the playbook's operating model, because the playbook's own warning is that a Level 3 environment drifts back toward Level 1 as clusters, applications and teams change. Two Day-2 items are worth flagging: *coverage reported as "policied and tested", not "installed"* (the playbook's sharpest distinction, and the number leadership actually needs), and *cluster upgrades gated on Kasten compatibility with a fresh backup first*.

---

## 3. Part two — the commands

### 3.1 Three principles

1. **Prove the assertion, not the existence of the noun.** If the item says "restore validated", the command must show restore actions and their outcomes.
2. **Fully-qualify every K10 CRD.** `policies.config.kio.kasten.io`, never `policies`. Short names collide — Kyverno, Calico, Gatekeeper and several service meshes all register something called `policies`, so the short form silently queries the wrong API group on exactly the busy, mature clusters where being wrong matters most.
3. **Discover rather than assert, where a field path might move.** Better to enumerate available Prometheus metric names than to hard-code metric names that may not exist on the customer's version.

Everything is read-only. Items that need a mutating action (create a snapshot, run a restore) say so in prose and are performed through the customer's own change process — they are not offered as copy-paste. Commands assume `kubectl`/`oc`, `jq` and `helm`; the diagnostics card states this.

### 3.2 Before and after

| Item | Before | After | What the new one proves |
|---|---|---|---|
| Backup policies configured | `kubectl get policies -n kasten-io` | `kubectl get policies.config.kio.kasten.io -n kasten-io -o json \| jq -r '.items[] \| [.metadata.name, (.spec.frequency // "-"), ((.spec.actions // []) \| map(.action) \| join("+")), ((.spec.retention // {}) \| tostring), ((.spec.selector // {}) \| tostring), ((.spec.paused // false) \| tostring)] \| @tsv' \| column -t -s $'\t'` | Scope, whether exports exist at all, retention, selector, and whether someone left it paused — four checklist questions from one command |
| — (new) | — | `... \| jq -r '.items[] \| select(((.spec.actions // []) \| map(.action) \| index("export")) == null) \| "SNAPSHOT-ONLY: " + .metadata.name'` | Names the policies that snapshot but never export |
| Supported Kubernetes version | `kubectl version --short` | `kubectl version -o json \| jq -r '"client: " + .clientVersion.gitVersion + "   server: " + .serverVersion.gitVersion'` | **`--short` was deprecated in 1.28 and removed** — the old command fails on any current kubectl |
| No CrashLoopBackOff pods | `kubectl get pods -A \| grep CrashLoopBackOff` | jq over pod phases and container waiting/terminated reasons | Catches ImagePullBackOff, Init:Error, CreateContainerConfigError and Pending too — and **exits 0 on a healthy cluster**, where `grep` exits 1 and looks like a failure |
| Logs free of errors | `kubectl logs -n kasten-io -l app=k10` | `kubectl logs -n kasten-io --selector=release=k10 --all-containers --prefix --tail=200 --since=24h \| grep -Ei 'error\|panic\|fail\|denied\|forbidden'` | **`app=k10` matches no pods** — the chart labels per component (`app=catalog-svc`, `app=gateway`) with `release=k10` as the common label. The old command returns nothing and reads as "no errors" |
| All K10 pods running | `kubectl get pods -n kasten-io` | jq surfacing phase, per-container readiness and **restart counts** | A pod that is Running but has restarted forty times is an unresolved problem waiting for the busiest backup window |
| Recent backups completed | `kubectl get backupactions -n kasten-io` | Fully-qualified, sorted by creation, last 25, with policy name, state, start and **end** times | Outcomes and durations — duration is what tells you the window is holding as data grows |
| Restore procedures tested | `kubectl get restoreactions -n kasten-io` | All namespaces, with state, start and end | Measured RTO, comparable against the target |
| VolumeSnapshotClass available | `kubectl get volumesnapshotclass...` | custom-columns with `DRIVER`, `DELETION` and the `k10.kasten.io/is-snapshot-class` annotation | That the annotation Kasten actually selects on is present, per driver |
| Default StorageClass configured | `kubectl get storageclass` | custom-columns with provisioner, default annotation, reclaim policy, `allowVolumeExpansion`, binding mode | Expansion and binding mode are restore-time facts worth knowing before the restore |
| Sufficient resources | `kubectl top nodes` | `kubectl get apiservices v1beta1.metrics.k8s.io` first, then `top` plus `describe nodes \| grep -A6 'Allocated resources'` | `top` returns nothing without the metrics API — check it before trusting a blank answer |
| Critical applications identified | `kubectl get deployments -A` | PVC inventory by namespace with class, mode, phase, size; plus image-based data-service discovery | Which workloads hold state, and which run engines needing Blueprints — from what is running, not from memory |
| — (new) | — | `helm get values k10 -n kasten-io` | Auth mode, FIPS, encryption, ingress, resource overrides, sidecar injection — the highest-value single command in the set |
| — (new) | — | `kubectl get namespace kasten-io -o jsonpath='{.metadata.uid}'` | The K10 cluster ID needed for a Kasten DR restore |

Also removed: the duplicate `kubectl get deployments --all-namespaces` under two different assertions, and the `oc` variants for every item. `oc` is now derived from the kubectl form by `ocCommandFor()`, with an explicit `oc` field only where the OpenShift path genuinely differs (routes, `oc adm top`, SCCs). That deletes about 80 duplicated strings that could drift apart.

### 3.3 Commands to validate against your K10 version before shipping

I would rather flag these than have a customer paste something that prints a confidently blank column. Each degrades safely — jq `//` fallbacks and `grep` over YAML mean a moved field shows as "field not found" rather than as an empty result — but the paths should be confirmed on a live cluster at the version you support:

| Command | Field to confirm |
|---|---|
| `PROFILE_SUMMARY` | `.spec.locationSpec.objectStore.protectionPeriod` — the immutability period. Falls back to `NO-IMMUTABILITY-SET`, and `PROFILE_RAW` greps the YAML as a backstop |
| `BACKUP_ACTION_HISTORY` | the `k10.kasten.io/policyName` label on actions |
| `ACTIONS_NOT_COMPLETE` | `.status.error.message` shape |
| `kdr-enabled` | the K10 DR policy name (`k10-disaster-recovery-policy`) and the DR secret name — both matched by `grep`, not asserted |
| `K10_METRIC_NAMES` | the `prometheus-server` service name in `kasten-io` |
| `MCM_DISCOVERY` | the `dist.kio.kasten.io` API group; deliberately written as discovery plus a fallback message |
| `encryption-key-escrowed` | secret naming — written as a `grep` over secret names for the same reason |

The K10 cluster ID being the `kasten-io` namespace UID is worth a quick confirmation too, since the DR runbook depends on it.

---

## 4. Part three — code and formatting

### 4.1 Structure

`app/page.tsx` goes from ~1,000 lines to 342 lines of composition:

```
lib/checklist-types.ts     types, dimension vocabulary, ocCommandFor()
lib/commands.ts            reusable command fragments, documented
lib/stages/poc.ts          30 items
lib/stages/preprod.ts      32 items
lib/stages/golive.ts       24 items
lib/stages/day2.ts         26 items
lib/checklist-data.ts      index, gate logic, dev-time invariant checks
lib/maturity.ts            checklist → maturity-model cross-reference
lib/checklist-state.ts     useAssessment(): persistence, import/export
lib/export-pdf.ts          PdfWriter + export (jsPDF dynamically imported)
components/ui/status-toggle.tsx
components/ui/command-block.tsx
components/checklist/stage-nav.tsx
components/checklist/section-card.tsx
components/checklist/maturity-panel.tsx
components/checklist/diagnostics-card.tsx
app/page.tsx               composition only
```

The `{(() => { ... })()}` IIFE wrapping the diagnostics card, with its constants declared inside the render, becomes a component with module-level data.

### 4.2 Bugs worth fixing regardless of anything else here

1. **`checked` is `boolean[][]` keyed by array position.** Insert an item at the top of a section and every saved answer shifts down by one, silently. Now a `Record<itemId, status>` with stable kebab-case ids, validated unique at import time in dev.
2. **The PDF's `✓` and `○` do not render.** jsPDF's built-in helvetica is WinAnsi-encoded and has no glyph for U+2713 or U+25CB, so they come out blank or as mojibake — in the one artefact that goes to auditors. Now `[PASS]` / `[FAIL]` / `[ N/A]` / `[    ]`, coloured.
3. **State is lost on refresh.** A 100-item checklist is walked through over days by more than one person. Now persisted to `localStorage`, with a quota-exceeded message that tells the user to export rather than failing silently.
4. **PDF output is unbounded.** A Popeye dump of tens of thousands of lines was written at 3.5 mm per line — a several-hundred-page PDF that freezes the tab while generating. Now capped at 400 lines per capture with an explicit truncation note; the full text stays in the browser and in the source file.
5. **Clipboard failures are swallowed.** `navigator.clipboard` is undefined outside a secure context — an Ingress on plain HTTP, exactly how an internal tool gets exposed. The button appeared to do nothing. Now falls back to `execCommand`, and if that fails says so and leaves the text selectable.
6. **Three different page-break limits.** `y > 260`, `y > 270`, `y > 282`, with the cursor advanced by hand at each call site. Content can clip at the foot of a page. `PdfWriter` owns the cursor and every write reserves its space first, so a break can never land mid-block.
7. **`useState(sections.map(...))`** evaluates the map on every render. `expanded` already uses the lazy form; `checked` did not.
8. **`percent` divides by `total`** with no guard — NaN if a section is ever emptied.

### 4.3 Other improvements

- **`jsPDF` is now dynamically imported** inside the export handler, removing ~150 KB from first load for a button most users press once.
- **JSON save/open.** The assessment becomes a versionable artefact: hand it to a colleague, diff it against last quarter's, commit it beside the cluster's IaC. `migrate()` is tolerant of partial and older payloads rather than discarding an assessment because one field moved.
- **The diagram stays out of `localStorage`.** A real cluster PNG is routinely several MB as a data URL against a ~5 MB quota — writing it there fails the whole save and takes the checklist answers with it. It lives in component state for the session and is re-attached at export.
- **Accessibility.** `role="radiogroup"`, `aria-checked`, `aria-current="step"` on the stage nav, labels bound to every input, `sr-only` labels on the capture textareas, `aria-hidden` on decorative SVGs, and section headings no longer nest an `<h2>` inside a button that duplicates the page heading.
- **Long commands.** Some jq pipelines are long. `CommandBlock` has a wrap / one-line toggle — wrapped is readable, one-line is copyable.

### 4.4 Repo hygiene

- **`README.md` still leads with stock `create-next-app` text** ("First, run the development server…", "Learn Next.js"). Everything below it is excellent. Replace the top with what the app is and the four-stage model; the deployment sections are already better than most.
- **`AGENTS.md` contains only the boilerplate Next.js agent rule.** Worth adding: where checklist data lives, how to add an item (id must be new and never reused), that `oc` is derived not duplicated, and that the PDF has no font beyond WinAnsi helvetica and courier.
- **No `LICENSE`.** A public repo carrying the Veeam logo and named after a Veeam product, with no licence file and no ownership statement, is worth resolving before it gets shared with customers.
- **No tests, and `validateChecklistData()` fills the gap cheaply.** It runs at import time in dev and catches duplicate ids, malformed ids, missing prose and out-of-range maturity levels with no test runner and no dependency. If you later add vitest, promote it to a real test.
- **Exposure warning.** The ClusterIP-only default is right. Worth stating explicitly in the README that the PDF may contain secret *names*, policy configuration and Popeye findings, so the app should not be exposed without auth — the footer and the diagnostics card now both say the data stays in the browser.
- **`app/api/k10-version/route.ts` is fine.** One thing to verify: `dynamic = "force-dynamic"` changes the default fetch cache to no-store, and you are relying on the explicit `next: { revalidate: 3600 }` to win. It should, since explicit options beat route defaults, but it is worth confirming you are actually getting the hour of caching the comment promises.

---

## 5. Part four — integrating the checklist with the maturity model

### 5.1 The relationship: evidence in one direction, judgement in the other

Every item carries one or more `[dimension, level]` tags against the playbook's seven dimensions. The checklist then reports, per dimension, the **highest level for which every tagged item is satisfied** — and names the specific items standing between that and the next level.

It does not score maturity, deliberately. Roughly half of each dimension's descriptor is process, ownership and cadence that no `kubectl` command can observe, and a tool that produced a maturity number from cluster state would be confidently wrong in the direction customers most want to be flattered. So:

- the **checklist evidences** — mechanically, from a real cluster, on a date;
- the **workbook judges** — a human sets Current and Target Level with the evidence in front of them.

That is a sharper version of the playbook's existing "Two checklists, one goal" callout, and it is why the relationship is one-directional: the workbook is never recomputed from the checklist.

**The contiguity rule matters.** Levels are counted upward and stop at the first level with an outstanding item. Passing three Level 4 items while a Level 2 item is still failing does not make an environment Level 4 — the model is a ladder, and what is reported is the highest rung with nothing missing below it. Where a dimension has no items defined at a level, the checklist passes over it rather than claiming or denying it, and says so.

### 5.2 What the customer sees

**In the app** — a *Maturity signals observed* panel: a five-segment bar per dimension, the evidenced level, the item count, and for each dimension the named items required for the next level. Every item row also carries its dimension·level chips inline, so the link to the playbook is visible at the point of work rather than only in the export.

**In the PDF** — a dedicated *Maturity signals observed* page, laid out for transcription into the workbook's Current Level column, with the outstanding items per dimension printed as the concrete next actions. This is what makes the Go-Live blocking item *"baseline maturity self-assessment completed and archived with this export"* a two-minute job rather than a workshop.

This also answers the question customers actually ask at the end of a POC — not "are we ready" but "what do we do next" — with a list of three specific things instead of a five-level model to interpret.

### 5.3 What the tags actually produce

I simulated the tagging to check it behaves. Clearing each stage in turn yields:

| Dimension | POC clear | + Pre-Prod | + Go-Live | + Day-2 |
|---|---|---|---|---|
| Coverage & Policy Automation | 2 | 2 | 3 | 5 |
| Application Consistency | 2 | 4 | 4 | 5 |
| Storage, Immutability & Security | 2 | 2 | 3 | 5 |
| Centralized Management & Multi-Cluster | 2 | 3 | 3 | 5 |
| Disaster Recovery | 2 | 2 | 3 | 5 |
| Observability, Compliance & Reporting | 1 | 1 | 2 | 5 |
| People, Process & Continuous Validation | 2 | 2 | 3 | 5 |

Two things to notice, both deliberate.

**The evidenced level lags the roadmap's nominal level, and it should.** The playbook maps Phase 3 to Level 4, but a customer at cutover cannot evidence "dashboard reviewed periodically" or "recovery testing scheduled quarterly" — those are operating practices with a time dimension. The evidenced level is a *floor*: what a cluster can demonstrate today. This matches the playbook's own observation that organisations should expect to operate at Level 4 for some time, under real production load and change, before Level 5 practices take hold. The panel and the PDF both say so, and it is why the workbook — where a human can score intent and process — stays authoritative.

**Application Consistency reaches 4 early.** It has fewer, sharper items and they are all Pre-Production work. That is honest rather than generous: if every Blueprint is deployed and validated end-to-end by restore plus the engine's own consistency check, that dimension genuinely is at Level 4 while others are not. The model is explicitly per-dimension, so uneven levels are the expected output, not a defect.

Tagging adjustments made while checking this, all in service of not blocking a lower rung with an operating practice: Day-2 cadence items now evidence L4 rather than re-blocking L2/L3 (`weekly-window-check`, `orphan-snapshot-sweep`, `weekly-job-review`); *dashboards published* moved to Observability L2, since publishing the dashboard is the configuration half of the playbook's "dashboard reviewed periodically"; and *at least two trained operators* moved from Day-2 governance into the Go-Live gate, because "can someone who did not build it recover this" is the go-live question and the playbook's People L3 descriptor is literally that more than one person can operate the environment.

Five items carry no maturity tag (`k8s-version-supported`, `headroom-for-backup`, `image-pull-path`, `k10-pods-healthy`, `dashboard-reachable`). They are platform hygiene, not maturity, and inventing a dimension for them would dilute the mapping.

### 5.4 The full path, end to end

| Roadmap phase | Checklist stage | Gate that must clear | Maturity established | Workbook action |
|---|---|---|---|---|
| Phase 1, Days 1–14 | POC | Restore from an *exported* restore point; passphrase escrowed; findings logged | Clears L1, establishes **L2** | Optional first read — score nothing yet |
| Phase 2, Days 15–45 | Pre-Production | Selector-driven coverage; immutability verified at storage; restore across namespace and cluster | **L3** on coverage, app consistency, storage | First light-touch score to expose the widest gaps |
| Phase 3, Days 46–75 + cutover | Go-Live | Alert delivery proven; KDR enabled and escrowed; runbook executed by someone else; sign-off | **L4** — recoverability proven, not assumed | **Baseline score, archived with the PDF** (blocking item) |
| Phase 4, Days 76–100 and beyond | Day-2 Operations | Monthly coverage audit; quarterly restore test; annual reassessment | Sustains L4, builds toward **L5** | Reassess annually, or after any incident, drill, fleet change or new regulatory requirement — track the delta |

This is the playbook's own Section 5 table with a column added for the gate that has to clear, so the roadmap, the checklist and the maturity model stop being three parallel documents.

### 5.5 Suggested changes to the playbook

- **§7 "Run the K10 Production Checklist"** describes a single production-readiness checklist. Rewrite it around the four stages, and state which gate maps to which maturity level. Section 7 is currently the only place the two artefacts meet, and it meets them as "also, there is a tool".
- **§5 "Roadmap: From Day 1 to Level 5"** — add the *checklist gate* column from 5.3 above to the existing phase/timeline/milestones/maturity table.
- **§6 "Using the Companion Self-Assessment"** — add a step 0: populate Current Level from the checklist's maturity signals page, then adjust on judgement. Right now §6 asks the customer to score seven dimensions from narrative descriptors with no evidence to hand, which is the hardest possible way to start.
- **The "Two checklists, one goal" callout** — sharpen to the division of labour: the checklist evidences a cluster on a date; the workbook judges an organisation over time.
- **§3.1 Operating cadence** — the Day-2 stage is a direct implementation of this table. Worth cross-referencing so a reader knows the cadence is executable, not just described.

### 5.6 Suggested changes to the workbook

The workbook is in good shape — the Recommendations tab's per-level-transition library is the most immediately useful thing in either document. Four additions:

1. **A `Journey` sheet.** Four rows, one per stage: gate status, date cleared, who signed off, and the filename of the exported PDF. This gives the workbook a place to record *when* each gate was passed, which is what turns it from a snapshot into a record.
2. **An `Evidence` column on the Self-Assessment sheet** — the checklist item ids that support the recorded Current Level, plus an *Evidence date* and *Evidenced by*. A maturity score with no date is unfalsifiable a year later.
3. **A `Checklist items` column on the Recommendations tab**, next to each level transition, naming the items that would evidence it. The recommendation text is already good; this makes it actionable in the tool.
4. **Two derived cells on Summary** — *stage reached* and *date of last reassessment*. The Summary currently shows current versus target by dimension, which is the right chart; adding the journey position lets one screenshot brief a steering group.

Worth noting a small inconsistency: the workbook's Self-Assessment descriptors are lightly abridged from the playbook's §2.3 tables (e.g. Coverage L2 drops the "(e.g., 1 daily / 4 weekly / 3 monthly)" example). Not wrong, but if both are maintained by hand they will drift. Generating the workbook's descriptor columns from a single source — the same `lib/stages/*.ts` tags could do it — would keep three artefacts in step.

---

## 6. Files

All under `k10-checklist/`, mirroring the repo layout. Drop-in replacements and new files; nothing in `deploy/`, `Dockerfile`, `.github/` or `app/api/` needs to change.

| File | New / replaces |
|---|---|
| `lib/checklist-types.ts` | new |
| `lib/commands.ts` | new |
| `lib/stages/{poc,preprod,golive,day2}.ts` | new |
| `lib/checklist-data.ts` | new |
| `lib/maturity.ts` | new |
| `lib/checklist-state.ts` | new |
| `lib/export-pdf.ts` | new (extracted from `page.tsx`) |
| `components/ui/status-toggle.tsx` | new (replaces `checkbox.tsx` usage) |
| `components/ui/command-block.tsx` | new |
| `components/checklist/stage-nav.tsx` | new |
| `components/checklist/section-card.tsx` | new |
| `components/checklist/maturity-panel.tsx` | new |
| `components/checklist/diagnostics-card.tsx` | new |
| `app/page.tsx` | **replaces** the existing file |

`components/ui/{card,checkbox,progress}.tsx` become unused — `card` and `progress` are replaced by plain markup, `checkbox` by the tri-state toggle. Delete or keep as you prefer. No new dependencies; `jspdf` is already in `package.json` and is now imported dynamically.

I could not run `tsc` or `eslint` in this environment (no npm registry access), so treat the code as reviewed-not-compiled: expect to fix a small number of type or lint nits on first build. Verified by hand: bracket balance across all 18 files, unique item ids, every item has `why`, `evidence` and at least the fields the types require, and the gate/maturity logic against the intended semantics.

---

## 7. Open questions

1. **Blocking set.** 48 of 112 is my judgement of "would you sign off recovery without this". Yours is better than mine on which items customers can realistically clear before a POC ends.
2. **112 items** — too many? The stage split and N/A make it manageable, but if you want it leaner the Day-2 governance section and some Pre-Production conditionals are the compressible parts.
3. **Should Day-2 be re-runnable as a periodic assessment?** It is currently one stage in one document. A "new Day-2 review" action that clones the meta and clears the statuses, so a customer accumulates quarterly reviews, would suit the cadence better — small addition to `checklist-state.ts` if you want it.
4. **Multi-cluster.** The assessment is single-cluster: one `clusterName` field. A fleet customer at Level 4 will want a per-cluster roll-up, which is a bigger change than anything here — worth deciding before customers ask.
5. **Do you want the workbook rebuilt** with the `Journey` sheet, `Evidence` columns and the `Checklist items` column from §5.6? That is a separate deliverable and I can produce it.

---

**Source:** [jricho/k10-checklist](https://github.com/jricho/k10-checklist) — reviewed at `main`, 13 commits. Playbook, workbook and 100-day roadmap read from the uploaded copies.
