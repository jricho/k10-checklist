"use client";

// Retrieval over the reference documents — no model, no network egress.
//
// Why not an LLM: everything else about this tool holds the line that nothing
// leaves the browser. The footer says so, the deployment is ClusterIP-only, and
// the README has an air-gap story. A chat endpoint would mean the customer's
// questions — which name their clusters, their gaps and their RTO commitments —
// leave their environment, and the deployment would need egress plus a secret.
// For a tool whose output a security reviewer signs, that is a poor trade for
// conversational phrasing.
//
// So this answers questions by finding the passage that answers them and showing
// it verbatim, with its section reference. Two consequences worth stating plainly:
// it cannot hallucinate, because every word displayed is text from a document;
// and it cannot synthesise across passages, so a question spanning three sections
// returns three results rather than one paragraph. That is the honest trade.
//
// The index is generated from the source documents and served from
// public/reference-index.json, fetched on first use so it never enters the
// initial bundle. Regenerating it is a manual step — see AGENTS.md.

export interface Chunk {
  id: string;
  /** Which document. Drives the badge and the link. */
  source: "playbook" | "workbook" | "roadmap";
  /** Section number for the playbook, sheet name for the workbook, page for the roadmap. */
  section: string;
  title: string;
  text: string;
  href: string;
  page?: number;
}

export interface Hit {
  chunk: Chunk;
  score: number;
  /** Text window centred on the strongest match, for display. */
  snippet: string;
  /** Query terms that actually matched, for highlighting. */
  matched: string[];
}

export const SOURCE_LABELS: Record<Chunk["source"], string> = {
  playbook: "Resilience Playbook",
  workbook: "Self-Assessment workbook",
  roadmap: "100-day roadmap",
};

/**
 * Domain synonyms.
 *
 * Without these the search is close to useless for the questions people actually
 * ask: someone types "air gap" and the playbook says "air-gapped"; someone types
 * "object lock" and the text says "immutability". Each entry expands a query term
 * into the vocabulary the documents use, not the other way round.
 */
const SYNONYMS: Record<string, string[]> = {
  rpo: ["recovery", "point", "objective", "data", "loss"],
  rto: ["recovery", "time", "objective", "downtime"],
  immutable: ["immutability", "object", "lock", "write-once", "worm"],
  immutability: ["immutable", "object", "lock", "ransomware"],
  objectlock: ["immutability", "immutable", "retention"],
  airgap: ["air-gapped", "disconnected", "offline", "edge"],
  airgapped: ["air-gap", "disconnected", "offline"],
  blueprint: ["kanister", "application-consistent", "quiesce", "quiescing"],
  kanister: ["blueprint", "application-consistent", "quiesce"],
  mcm: ["multi-cluster", "manager", "global", "policies", "fleet"],
  kdr: ["disaster", "recovery", "catalog", "passphrase", "cluster", "id"],
  dr: ["disaster", "recovery", "standby", "topology"],
  snapshot: ["csi", "volumesnapshot", "storage"],
  restore: ["recovery", "recover", "restoring"],
  export: ["offsite", "location", "profile", "object", "storage"],
  policy: ["policies", "selector", "retention", "schedule"],
  maturity: ["level", "dimension", "adaptive", "resilient", "managed"],
  compliance: ["soc", "pci-dss", "hipaa", "audit", "retention"],
  cost: ["finops", "lifecycle", "tier", "storage"],
  cadence: ["daily", "weekly", "monthly", "quarterly", "annually", "review"],
  drill: ["game-day", "exercise", "test", "testing"],
  vault: ["veeam", "immutable", "object", "storage"],
};

const STOPWORDS = new Set(
  ("a an and are as at be but by do does for from how i if in into is it its of on or should so than that the " +
    "their then there these they this to was what when where which who why will with you your can could would " +
    "we our us my me do we need must have has had about").split(" "),
);

/**
 * Light stemming: strip a plural `s`, and `ies` → `y`.
 *
 * Not a real stemmer, and it does not need to be. It exists so "restores"
 * matches "restore", "drills" matches "drill" and "policies" matches "policy" —
 * the three inflections that actually come up in questions about this material.
 */
function stem(t: string): string {
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

/**
 * Tokeniser.
 *
 * Hyphenated compounds emit the whole token *and* its parts. Without this,
 * "air-gapped" in the documents is a single token that a query for "air gapped"
 * can never match — which it did not, and a question about air-gapped edge sites
 * missed the section literally titled "Edge and air-gapped patterns". The same
 * trap applies to multi-cluster, application-consistent, write-once and
 * export-only, all of which appear hyphenated in the text and unhyphenated in
 * speech.
 */
function tokenise(s: string): string[] {
  const raw = s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map(t => t.replace(/^-+|-+$/g, ""))
    .filter(Boolean);

  const out: string[] = [];
  for (const t of raw) {
    if (t.includes("-")) {
      out.push(t.replace(/-/g, "")); // airgapped
      for (const part of t.split("-")) {
        if (part.length > 1 && !STOPWORDS.has(part)) out.push(stem(part));
      }
    }
    if (t.length > 1 && !STOPWORDS.has(t)) out.push(stem(t));
  }
  return out;
}

/** Query terms plus their domain expansions, de-duplicated. */
function expand(terms: string[]): { core: string[]; expanded: Set<string> } {
  const expanded = new Set<string>(terms);
  for (const t of terms) {
    const key = t.replace(/-/g, "");
    for (const s of SYNONYMS[key] ?? []) expanded.add(s);
  }
  return { core: terms, expanded };
}

interface Prepared {
  chunks: Chunk[];
  /** token -> number of chunks containing it, for idf. */
  df: Map<string, number>;
  /** per-chunk token counts. */
  tf: Map<string, number>[];
  lengths: number[];
  avgLength: number;
}

let prepared: Prepared | null = null;
let loading: Promise<Prepared> | null = null;

/** Fetch and prepare the index. Cached; safe to call on every drawer open. */
export function loadIndex(): Promise<Prepared> {
  if (prepared) return Promise.resolve(prepared);
  if (loading) return loading;
  loading = fetch("/reference-index.json")
    .then(r => {
      if (!r.ok) throw new Error(`reference index unavailable (${r.status})`);
      return r.json() as Promise<Chunk[]>;
    })
    .then(chunks => {
      const df = new Map<string, number>();
      const tf: Map<string, number>[] = [];
      const lengths: number[] = [];
      for (const c of chunks) {
        // Title and section are repeated into the token stream so that a query
        // naming a section ("4.7", "disaster recovery patterns") ranks that
        // section's own chunk above passages that merely mention it.
        const tokens = tokenise(`${c.title} ${c.title} ${c.section} ${c.text}`);
        const counts = new Map<string, number>();
        for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
        for (const t of counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
        tf.push(counts);
        lengths.push(tokens.length);
      }
      prepared = {
        chunks,
        df,
        tf,
        lengths,
        avgLength: lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length),
      };
      return prepared;
    })
    .catch(err => {
      loading = null;
      throw err;
    });
  return loading;
}

const K1 = 1.4; // term-frequency saturation
const B = 0.72; // length normalisation

/**
 * Per-source weighting.
 *
 * The roadmap is a two-column marketing PDF, and text extraction interleaves the
 * body with the sidebar — producing chunks like "It's also commonly used with
 * Identify your most critical workloads. These drive your Red Hat OpenShift".
 * Those chunks match a lot of terms without being about anything, and they were
 * displacing clean playbook passages that answered the question directly.
 *
 * The discount is small: the roadmap is still the best source for milestone and
 * phase questions, and it wins those on term matches alone.
 */
const SOURCE_WEIGHT: Record<Chunk["source"], number> = {
  playbook: 1,
  workbook: 1,
  roadmap: 0.82,
};

/**
 * BM25 over 122 chunks — small enough that a linear scan is instant and a real
 * search library would be a dependency earning nothing.
 *
 * Expanded synonym terms score at a discount so a literal match always outranks
 * a synonym match: someone typing "immutability" should get the immutability
 * passage first, not the ransomware one that merely relates to it.
 */
export function search(query: string, limit = 6): Hit[] {
  if (!prepared) return [];
  const { chunks, df, tf, lengths, avgLength } = prepared;
  const N = chunks.length;

  const terms = tokenise(query);
  if (terms.length === 0) return [];
  const { core, expanded } = expand(terms);
  const coreSet = new Set(core);
  const phrase = query.trim().toLowerCase();

  const hits: Hit[] = [];
  for (let i = 0; i < N; i++) {
    let score = 0;
    const matched: string[] = [];
    for (const term of expanded) {
      const freq = tf[i].get(term);
      if (!freq) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const norm = freq * (K1 + 1) / (freq + K1 * (1 - B + B * (lengths[i] / avgLength)));
      score += idf * norm * (coreSet.has(term) ? 1 : 0.45);
      if (coreSet.has(term)) matched.push(term);
    }
    if (score === 0) continue;

    // Whole-phrase presence is a strong signal and cheap to check.
    if (phrase.length > 8 && chunks[i].text.toLowerCase().includes(phrase)) score *= 1.8;

    score *= SOURCE_WEIGHT[chunks[i].source];

    hits.push({ chunk: chunks[i], score, snippet: snippetFor(chunks[i].text, matched), matched });
  }

  // One result per section. Long sections are split across several chunks, and
  // without this a query like "how often should we test restores" spends two of
  // its three visible slots on consecutive passages from the same page. Breadth
  // across documents is more useful than depth within one.
  const seen = new Set<string>();
  const deduped: Hit[] = [];
  for (const hit of hits.sort((a, b) => b.score - a.score)) {
    const key = `${hit.chunk.source}|${hit.chunk.section}|${hit.chunk.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(hit);
    if (deduped.length === limit) break;
  }
  return deduped;
}

/**
 * A window of about 320 characters centred on the first matched term, trimmed to
 * sentence boundaries where possible so the result reads as prose rather than as
 * a fragment starting mid-word.
 */
function snippetFor(text: string, matched: string[]): string {
  const WINDOW = 320;
  if (text.length <= WINDOW) return text;

  let at = -1;
  for (const term of matched) {
    const idx = text.toLowerCase().indexOf(term);
    if (idx !== -1 && (at === -1 || idx < at)) at = idx;
  }
  if (at === -1) at = 0;

  let start = Math.max(0, at - Math.floor(WINDOW / 3));
  let end = Math.min(text.length, start + WINDOW);

  const sentence = text.lastIndexOf(". ", start);
  if (sentence !== -1 && start - sentence < 90) start = sentence + 2;
  const nextStop = text.indexOf(". ", end - 40);
  if (nextStop !== -1 && nextStop - end < 90) end = nextStop + 1;

  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

/**
 * Questions the documents cannot answer — anything about product mechanics,
 * versions, or CLI syntax — belong in the Kasten documentation. Detected by
 * vocabulary rather than by a failed search, because a low-scoring result is
 * worse than an honest redirect.
 */
const PRODUCT_TERMS = [
  "install", "helm", "upgrade", "version", "chart", "command", "cli", "api", "crd",
  "error", "troubleshoot", "log", "port", "ingress", "licence", "license", "syntax",
  "kubectl", "namespace", "yaml", "operator", "supported",
];

export function looksLikeProductQuestion(query: string): boolean {
  const t = new Set(tokenise(query));
  return PRODUCT_TERMS.some(p => t.has(p));
}

export function kastenDocsSearchUrl(query: string): string {
  return `https://docs.kasten.io/latest/search.html?q=${encodeURIComponent(query.trim())}`;
}
