This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
