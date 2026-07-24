## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

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
