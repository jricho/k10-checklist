import type { Metadata } from "next";
import { boundaryIsSelfEvident, contrastRatio, ratio } from "../../lib/contrast";

// A permanent comparison harness for page-background decisions.
//
// This route exists because the neutral ramp and the background were both chosen
// by looking at real components side by side, and both would otherwise have been
// chosen by comparing hex values in the abstract — which is how you end up with a
// palette that measures well and reads badly. Keeping it in the tree means the
// next person revisiting either decision starts from a rendering rather than from
// git history.
//
// It is deliberately not linked from the app. A customer has no use for it, and
// it is one static route, so the cost of keeping it is a few kilobytes.
//
// The samples below hardcode their own colours rather than consuming the tokens,
// for the obvious reason: the point is to compare candidate values, and a sample
// that read `--page-bg` would render four identical panels.

export const metadata: Metadata = {
  title: "Background comparison — internal",
  robots: { index: false, follow: false },
};

const CARD = "#ffffff";
const CARD_DARK = "#0e1620";

interface Candidate {
  label: string;
  value: string;
  chosen?: boolean;
  note: string;
}

const LIGHT: Candidate[] = [
  {
    label: "Flattened current",
    value: "#e9eef3",
    chosen: true,
    note: "The value already in use, with the noise tile and both radial washes removed. Chosen: it isolates the change to going flat, without also moving the hue.",
  },
  {
    label: "Deeper slate",
    value: "#dbe3ec",
    note: "Cards read as panels rather than as the page. The closest of the four to the AWS-console feel the brief asks for, at the cost of a heavier frame.",
  },
  {
    label: "Near-white",
    value: "#f5f8fa",
    note: "Airier over a long session, but the card boundary rests entirely on the border — the fill difference is below the threshold where an edge is self-evident.",
  },
  {
    label: "Brand-tinted",
    value: "#e4ece8",
    note: "Pulled a few degrees toward the Veeam green. Ties the page to the brand, but green-grey reads as sickly on poorly calibrated projectors.",
  },
];

const DARK: Candidate[] = [
  {
    label: "Flattened current",
    value: "#080d13",
    chosen: true,
    note: "Cards at #0e1620 measure only 1.07:1 against this — weaker than light mode's 1.17:1, because both values sit near the floor of the ramp where sRGB has little room left. Dark mode leans harder on the border, not less.",
  },
  {
    label: "Lifted",
    value: "#0e141c",
    note: "Less of a void, but the card and the page are then within 1.02:1 and the edge disappears entirely. If dark mode needs more separation the answer is a stronger --color-line, not a lighter page.",
  },
];

function Swatch({ candidate, card, dark }: { candidate: Candidate; card: string; dark?: boolean }) {
  const r = contrastRatio(card, candidate.value);
  const selfEvident = boundaryIsSelfEvident(card, candidate.value);

  return (
    <section
      className="rounded-card p-5"
      style={{ backgroundColor: candidate.value }}
      aria-label={`${candidate.label}, ${candidate.value}`}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3
          className="font-display text-sm font-semibold"
          style={{ color: dark ? "#f2f5f9" : "#0b1118" }}
        >
          {candidate.label} {candidate.chosen && <span aria-label="chosen">— chosen</span>}
        </h3>
        <code className="text-2xs font-mono" style={{ color: dark ? "#aab7c5" : "#3c4854" }}>
          {candidate.value}
        </code>
      </div>

      {/* A card, because a background can only be judged against what sits on it. */}
      <div
        className="rounded-card p-4 border"
        style={{
          backgroundColor: card,
          borderColor: dark ? "#1e2833" : "#d3dce5",
          boxShadow: dark
            ? "0 1px 2px rgb(0 0 0 / 0.4), 0 1px 3px rgb(0 0 0 / 0.3)"
            : "0 1px 2px rgb(11 19 27 / 0.04), 0 1px 3px rgb(11 19 27 / 0.06)",
        }}
      >
        <div
          className="text-2xs font-semibold uppercase tracking-[0.12em] mb-1"
          style={{ color: dark ? "#aab7c5" : "#3c4854" }}
        >
          Stage 3 · Go-Live
        </div>
        <div
          className="font-display text-base font-semibold mb-2"
          style={{ color: dark ? "#f2f5f9" : "#0b1118" }}
        >
          Production cutover
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* The gate badge is the loudest object in the real app; if a
              background makes it less immediately legible, that is a
              regression regardless of how the page looks. */}
          <span
            className="rounded-lg px-3 py-1.5 font-display text-sm font-bold tracking-wide"
            style={{ backgroundColor: "#92610a", color: "#ffffff" }}
          >
            3 BLOCKING OPEN
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-2xs font-semibold border"
            style={{
              borderColor: dark ? "#1e2833" : "#d3dce5",
              color: dark ? "#ccd6e0" : "#2b3540",
            }}
          >
            Security 15
          </span>
        </div>
        <pre
          className="mt-3 rounded-lg px-3 py-2 text-2xs font-mono overflow-x-auto"
          style={{ backgroundColor: "#080d13", color: "#ccd6e0" }}
        >
          kubectl -n kasten-io get pods -l release=k10
        </pre>
      </div>

      <dl className="mt-3 flex gap-x-5 gap-y-1 flex-wrap text-2xs">
        <div className="flex gap-1.5">
          <dt style={{ color: dark ? "#aab7c5" : "#3c4854" }}>Card vs page</dt>
          <dd className="font-mono font-semibold" style={{ color: dark ? "#f2f5f9" : "#0b1118" }}>
            {ratio(card, candidate.value)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt style={{ color: dark ? "#aab7c5" : "#3c4854" }}>Edge self-evident</dt>
          <dd className="font-mono font-semibold" style={{ color: dark ? "#f2f5f9" : "#0b1118" }}>
            {selfEvident ? "yes" : `no — border is load-bearing (${r.toFixed(2)} < 1.20)`}
          </dd>
        </div>
      </dl>

      <p className="text-xs mt-2 leading-relaxed" style={{ color: dark ? "#aab7c5" : "#3c4854" }}>
        {candidate.note}
      </p>
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="font-display text-2xl font-semibold text-ink mb-2">Page background</h1>
      <p className="text-sm text-ink-muted max-w-3xl leading-relaxed mb-3">
        Flat block colour, replacing a noise tile plus two radial washes. Each panel below is a candidate
        page colour with a real card, gate badge, pillar chip and command block on it, because a background
        is only ever seen underneath something. Ratios are measured by{" "}
        <code className="font-mono text-xs">lib/contrast.ts</code>, not asserted.
      </p>
      <p className="text-xs text-ink-faint max-w-3xl leading-relaxed mb-8">
        Internal route, not linked from the app and marked <code className="font-mono">noindex</code>.
        Samples hardcode their colours rather than reading the tokens — a sample that consumed{" "}
        <code className="font-mono">--page-bg</code> would render four identical panels. That also means
        these panels do not respond to your system colour scheme; the dark candidates are below.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mb-4">Light</h2>
      <div className="grid md:grid-cols-2 gap-5 mb-10">
        {LIGHT.map(c => (
          <Swatch key={c.value} candidate={c} card={CARD} />
        ))}
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mb-4">Dark</h2>
      <div className="grid md:grid-cols-2 gap-5">
        {DARK.map(c => (
          <Swatch key={c.value} candidate={c} card={CARD_DARK} dark />
        ))}
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mt-10 mb-3">Why flat</h2>
      <ul className="text-sm text-ink-muted max-w-3xl space-y-2 leading-relaxed list-disc pl-5">
        <li>
          Density is this application&apos;s hard problem. A textured page is one more thing competing for
          attention, and the only one carrying no information.
        </li>
        <li>
          It is screen-shared and screenshotted constantly. Under compression the noise tile turns to mush
          and the washes band — both read as a bad connection rather than as design.
        </li>
        <li>
          The PDF has neither, and screen and export are meant to read as the same document.
        </li>
      </ul>
      <p className="text-sm text-ink-muted max-w-3xl leading-relaxed mt-3">
        The cost is that card separation now rests on <code className="font-mono text-xs">border-line</code>{" "}
        and <code className="font-mono text-xs">--shadow-card</code> alone. At {ratio(CARD, "#e9eef3")} the
        fill boundary is not self-evident, so the border is load-bearing and must not be softened.
      </p>
    </main>
  );
}
