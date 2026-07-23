// Returns the latest Veeam Kasten K10 release version by reading the public
// Helm chart index. Fetched server-side to avoid browser CORS restrictions.
//
// `force-dynamic` keeps this off the build-time prerender path: the upstream
// fetch happens at request time, never during `next build` (which would make
// the CI image build depend on — and potentially hang on — network egress).
// The fetch itself is still cached for an hour via the data cache, and a hard
// timeout ensures a slow/unreachable upstream can never block a request.

export const dynamic = "force-dynamic";

const INDEX_URL = "https://charts.kasten.io/index.yaml";
const TIMEOUT_MS = 5000;

// Compare two "x.y.z" strings; returns > 0 when a is newer than b.
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

export async function GET() {
  try {
    const res = await fetch(INDEX_URL, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return Response.json({ version: null, error: `upstream ${res.status}` }, { status: 200 });
    }
    const text = await res.text();

    // Chart artifacts are named "k10-<x.y.z>.tgz" (the k10restore chart uses a
    // different prefix, so this pattern matches only the K10 chart).
    const versions = [...text.matchAll(/k10-(\d+\.\d+\.\d+)\.tgz/g)].map(m => m[1]);
    if (versions.length === 0) {
      return Response.json({ version: null, error: "no versions found" }, { status: 200 });
    }

    const latest = versions.reduce((max, v) => (compareSemver(v, max) > 0 ? v : max));
    return Response.json({ version: latest });
  } catch {
    return Response.json({ version: null, error: "fetch failed" }, { status: 200 });
  }
}
