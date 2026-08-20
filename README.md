# Veeam Kasten readiness checklist

A self-hosted web app for working through — and evidencing — a customer's journey
from a Kasten proof of concept to day-2 operating maturity, against a real
cluster. Step through the checklist interactively, paste in the output of the
verification commands, and export a PDF for the change record, the go-live
sign-off or the audit evidence pack.

No backend, no cluster access, no telemetry. Everything stays in the browser;
the app never sees your kubeconfig.

## The four stages

Readiness is not one question, so the checklist is not one list. Each stage has
its own items, its own exit criteria, and a gate made of named **blocking**
items — never a completion percentage, because an 80%-complete checklist that
happens to be missing "restore proven from an exported restore point" is not 80%
ready.

| Stage | Roadmap phase | The question it answers |
|---|---|---|
| **Proof of Concept** | Phase 1 — Foundation, Days 1–14 | Can we get *this* environment's data back? |
| **Pre-Production** | Phase 2 — Harden the Basics, Days 15–45 | Is protection automatic, consistent, offsite and immutable? |
| **Go-Live** | Phase 3 — Optimize & Harden, Days 46–75 | Will anyone know when it fails, and can someone else recover it? |
| **Day-2 Operations** | Phase 4 — Prove Value, Days 76–100 and beyond | Is maturity being sustained, or quietly decaying? |

Stages map to the phases of *Your Path to Resilience with Veeam Kasten*. Every
item is answered **Pass / Fail / N/A** — N/A leaves the denominator, so a
single-cluster customer is not penalised for the multi-cluster section, and an
explicit Fail records a known, accepted gap rather than an unanswered question.

## Workload tiers and DR topology

A tier table — one row per workload tier with an RPO target, an RTO target, a DR
topology (cold / warm / export-only) and the restore time actually measured in a
test. The playbook's RTO characteristic for each topology is shown while you
choose, and the app flags combinations that cannot work: an export-only topology
implies a multi-hour to multi-day RTO, so pairing it with a two-hour commitment
is worth a conversation before go-live rather than during an incident.

Warnings inform, they do not block. They also fire when a *measured* restore
already exceeds its target — at which point the RTO is not a risk, it is unmet.
The whole table prints on the cover of the exported PDF, unresolved warnings
included, because that is precisely what a reviewer should see before signing.

## Maturity model integration

Each item is tagged with the dimension and level it evidences in the Kasten
Maturity Model. The app reports, per dimension, the highest level for which
every tagged item is satisfied, and names the items standing between that and
the next level. The PDF carries this on its own page, laid out for transcription
into the *Kasten Maturity Self-Assessment* workbook.

This is deliberately evidence, not a score: about half of each dimension's
descriptor concerns process, ownership and cadence that no `kubectl` command can
observe, so the workbook remains the authoritative instrument. The checklist
evidences a cluster on a date; the workbook judges an organisation over time.

## Reference documents

Both ship in `public/`, so the links resolve in a self-hosted or air-gapped
deployment rather than pointing at an intranet:

| File | What it is |
|---|---|
| [`kasten-resilience-playbook.pdf`](public/kasten-resilience-playbook.pdf) | The maturity model, day-2 operating model and reference architecture this checklist is built from. Each stage cites the sections it draws on, shown under the stage goal and printed in the export |
| [`kasten-maturity-self-assessment.xlsx`](public/kasten-maturity-self-assessment.xlsx) | The scoring workbook. Sheets are *Instructions*, **Self-Assessment** (the one you fill in), *Summary* and *Recommendations* |

> **Maintainers:** both are copies of canonical documents. When either changes,
> replace the file here and check that (a) the workbook's level descriptors still
> match the `signals` tags in `lib/stages/*.ts`, and (b) the section numbers in
> each stage's `playbookRefs` still point where they claim to.

## Verification commands

Every item that can be evidenced from the cluster carries a `kubectl` command
(and an `oc` form, derived automatically unless the OpenShift path genuinely
differs). They are all read-only, and they aim to prove the assertion rather
than the existence of the noun — `kubectl get policies` tells you a policy
exists; the command here tells you whether it exports, what it retains, what it
selects and whether someone left it paused.

Requires `kubectl` or `oc`, plus `jq` and `helm`, on the operator's workstation.

## Assessment state

Answers, notes and captured output persist to browser `localStorage`, so a
reload or a closed laptop does not lose an assessment walked through over
several days. **Save** exports the whole assessment as JSON — version it
alongside the cluster's IaC, hand it to a colleague, or diff it against last
quarter's. **Open** restores one.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npx tsc --noEmit
npm run lint
```

Checklist content lives in `lib/stages/*.ts`; see [AGENTS.md](AGENTS.md) for the
conventions that matter when editing it.

## Run as a container

The repo ships a multi-stage [Dockerfile](Dockerfile) that produces a small
production image from Next.js's `output: 'standalone'` build. The image
listens on port `8080`, runs as a non-root user, and is compatible with
OpenShift's `restricted-v2` SCC (arbitrary UID in group 0).

### Build and run locally

```bash
docker build -t k10-checklist:dev .
docker run --rm -p 8080:8080 k10-checklist:dev
# open http://localhost:8080
```

### Pull the published image

The image is published to Docker Hub at
[`jricho/k10-checklist`](https://hub.docker.com/r/jricho/k10-checklist).

```bash
docker run --rm -p 8080:8080 docker.io/jricho/k10-checklist:latest
# open http://localhost:8080
```

Multi-arch (`linux/amd64`, `linux/arm64`) images are built and pushed by
[.github/workflows/container.yaml](.github/workflows/container.yaml) on every
push to `main` and on tags matching `v*.*.*`.

## Deploy to Kubernetes

You don't need to clone this repo. Every tagged release ships a single
`install.yaml` (Namespace + Deployment + Service, image tag pre-pinned)
attached as a GitHub Release asset. Apply it directly:

```bash
# Replace v0.1.0 with the release you want — see the Releases page:
# https://github.com/jricho/k10-checklist/releases
kubectl apply -f https://github.com/jricho/k10-checklist/releases/download/v0.1.0/install.yaml

kubectl -n k10-checklist rollout status deploy/k10-checklist
```

What gets created:

- Namespace `k10-checklist`
- Deployment `k10-checklist` (2 replicas, pulls `docker.io/jricho/k10-checklist:<tag>`)
- Service `k10-checklist` (ClusterIP, port `80` → container `8080`)

The Service is `ClusterIP` only — no Ingress or Route is provisioned, so the
app is reachable only from inside the cluster. Expose it locally:

```bash
kubectl -n k10-checklist port-forward svc/k10-checklist 8080:80
# open http://localhost:8080
```

Tear down:

```bash
kubectl delete -f https://github.com/jricho/k10-checklist/releases/download/v0.1.0/install.yaml
```

### OpenShift

The same `install.yaml` works on OpenShift — substitute `oc` for `kubectl`.
The Deployment does not pin `runAsUser`, so the `restricted-v2` SCC will
assign a UID from the project's range; the image's `/app` tree is
group-writable (gid 0), so that UID can read/write fine.

### Deploy from a cloned repo (customize before apply)

If you want to tweak resources, replicas, or the image tag before applying,
clone the repo and use the kustomize bundle under [deploy/](deploy/):

```bash
git clone https://github.com/jricho/k10-checklist
cd k10-checklist/deploy
kustomize edit set image \
  docker.io/jricho/k10-checklist=docker.io/jricho/k10-checklist:v0.1.0
kubectl apply -k .
```

## Attach a cluster architecture diagram

The checklist has an optional **Cluster Architecture Diagram** card that
accepts a PNG/JPEG upload and embeds it on its own page in the exported PDF.
Generate the diagram with [philippemerle/KubeDiagrams](https://github.com/philippemerle/KubeDiagrams) —
a Python tool that turns Kubernetes manifests into architecture diagrams
(via the mingrammer `diagrams` library + Graphviz).

Prerequisites: **Python 3.9+** and **Graphviz** (the `dot` binary must be on
`$PATH`). On macOS: `brew install graphviz pipx`. On Debian/Ubuntu:
`sudo apt-get install graphviz pipx`.

Modern Python installs are PEP 668–protected and reject system-wide
`pip install`, so use **pipx** to drop the `kube-diagrams` CLI into an
isolated environment without touching the system interpreter:

```bash
# 1. Install KubeDiagrams as a managed CLI tool:
pipx ensurepath              # adds ~/.local/bin to PATH (restart your shell after)
pipx install KubeDiagrams

# 2. Render a diagram from your live cluster (stdin, with `-` as the source):
kubectl get all --all-namespaces -o yaml | kube-diagrams -o k10-arch.png -

# Or from one or more manifest files (flag before filename):
kube-diagrams -o k10-arch.png ./manifests.yaml
```

If you'd rather not use pipx, a project-local virtualenv works equally well:
`python3 -m venv .venv && source .venv/bin/activate && pip install KubeDiagrams`.

Refer to the [project README](https://github.com/philippemerle/KubeDiagrams)
for additional flags (`-n <namespace>`, `-f <format>`, `--without-namespace`,
custom config files, etc.).

In the deployed checklist, scroll to **Cluster Architecture Diagram**, click
**Click to upload diagram**, and select `k10-arch.png`. The image stays in
browser state — nothing is uploaded to a backend — and is embedded on a
dedicated page when you **Export PDF**.

## Run the cluster sanitizer (Popeye)

The **Diagnostic Tools** card includes a **Cluster Sanitizer (Popeye)** command.
[Popeye](https://popeyecli.io) is a read-only Kubernetes linter that reports
misconfigurations (missing probes, resource limits, dangling references, etc.).
Like the other diagnostics, you run it in your own shell against your current
kubeconfig context and paste/upload the output — it is then appended to the
exported PDF. Nothing runs server-side and the app needs no cluster access.

Install it first (macOS shown; see popeyecli.io for other platforms):

```bash
brew install derailed/popeye/popeye
```

Then run the scoped scan surfaced in the UI:

```bash
popeye -n kasten-io \
  -s po,deploy,sts,ds,svc,sa,sec,cm,pvc,ing,np,pdb,hpa,cronjobs,jobs,ro,rb \
  -o jurassic | tee popeye.txt
```

The scan is scoped to the `kasten-io` namespace and, via `-s`, limited to the
namespaced resource types K10 uses. Popeye cannot allow-list only K10-related
**cluster-scoped** resources (its config is exclude-only), so cluster-scoped
linters are intentionally left out to keep the report focused on K10. Paste
`popeye.txt` into the **Cluster Sanitizer** box or use **Load from file**.
