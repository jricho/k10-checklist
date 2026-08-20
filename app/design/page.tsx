"use client";

import { useState } from "react";

// Slate ramp comparison — a design scratch route.
//
// Not linked from the app and not intended to ship: once a ramp is chosen, copy
// its values into the @theme block in globals.css and delete this directory.
//
// It works by scoping the token overrides to a wrapper div. Tailwind v4 emits
// utilities as `color: var(--color-gray-500)`, so setting those variables on a
// container restyles everything inside it — the same mechanism dark mode uses,
// applied per-subtree. That means each panel below is the real components under a
// different ramp, not a mock-up of them.

type Ramp = {
  id: string;
  name: string;
  rationale: string;
  scale: Record<string, string>;
  ink: { ink: string; soft: string; muted: string; faint: string };
  surface: { surface: string; sunken: string; line: string; lineStrong: string; page: string };
};

const RAMPS: Ramp[] = [
  {
    id: "current",
    name: "A — Cool slate (shipped)",
    rationale:
      "What is in the repo now. Blue-leaning neutrals, mid-tones tuned so the lightest permitted text is 5.69:1.",
    scale: {
      "50": "#f7f9fb", "100": "#eef2f6", "200": "#dbe2ea", "300": "#b7c2ce", "400": "#697685",
      "500": "#586675", "600": "#46535f", "700": "#333f4b", "800": "#222e3a", "900": "#151f29",
      "950": "#0b131b",
    },
    ink: { ink: "#101923", soft: "#3a4653", muted: "#4a5765", faint: "#5b6877" },
    surface: { surface: "#ffffff", sunken: "#f1f4f8", line: "#dbe2ea", lineStrong: "#b7c2ce", page: "#eef2f6" },
  },
  {
    id: "deep",
    name: "B — Deeper, higher contrast",
    rationale:
      "Same hue, pushed darker through the mid-tones. Body text lands near 10:1 and the faintest permitted text near 7:1. Reads more like an infrastructure console; the trade is less air between the text levels.",
    scale: {
      "50": "#f5f8fa", "100": "#e9eef3", "200": "#d3dce5", "300": "#a7b4c2", "400": "#55636f",
      "500": "#46535f", "600": "#37434f", "700": "#28323c", "800": "#1b232c", "900": "#111820",
      "950": "#080d13",
    },
    ink: { ink: "#0b1118", soft: "#2b3540", muted: "#3c4854", faint: "#4c5865" },
    surface: { surface: "#ffffff", sunken: "#eef2f6", line: "#d3dce5", lineStrong: "#a7b4c2", page: "#e9eef3" },
  },
  {
    id: "warm",
    name: "C — Warm neutral",
    rationale:
      "Blue pulled out for a near-neutral grey. Calmer and less opinionated, and it lets the brand green and the enterprise blue read as the only hues on the page. Loses some of the 'deep slate' character the brief asked for.",
    scale: {
      "50": "#faf9f8", "100": "#f2f1ef", "200": "#e2e0dd", "300": "#bdbab5", "400": "#6b6862",
      "500": "#5a5751", "600": "#494640", "700": "#383530", "800": "#272521", "900": "#1a1815",
      "950": "#0f0e0c",
    },
    ink: { ink: "#141210", soft: "#3d3a35", muted: "#4d4a44", faint: "#5e5a54" },
    surface: { surface: "#ffffff", sunken: "#f5f4f2", line: "#e2e0dd", lineStrong: "#bdbab5", page: "#f2f1ef" },
  },
];

function lin(c: number) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string) {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rampVars(r: Ramp): React.CSSProperties {
  const vars: Record<string, string> = {
    "--color-ink": r.ink.ink,
    "--color-ink-soft": r.ink.soft,
    "--color-ink-muted": r.ink.muted,
    "--color-ink-faint": r.ink.faint,
    "--color-surface": r.surface.surface,
    "--color-surface-sunken": r.surface.sunken,
    "--color-line": r.surface.line,
    "--color-line-strong": r.surface.lineStrong,
  };
  for (const [k, v] of Object.entries(r.scale)) {
    vars[`--color-gray-${k}`] = v;
    vars[`--color-slate-${k}`] = v;
  }
  return vars as React.CSSProperties;
}

/** A miniature of the real interface: the surfaces and text levels that matter. */
function Specimen({ ramp }: { ramp: Ramp }) {
  const ratio = (fg: string) => contrast(fg, ramp.surface.surface).toFixed(2);
  return (
    <div style={rampVars(ramp)}>
      <div className="rounded-card p-4" style={{ background: ramp.surface.page }}>
        {/* Gate — unchanged across ramps, included so the brand green can be
            judged against each neutral rather than in isolation. */}
        <div className="inline-block rounded-lg px-4 py-2.5 font-display text-lg font-bold tracking-wide bg-brand-700 text-white mb-3">
          GATE CLEAR
        </div>

        <section className="bg-surface border border-line rounded-card shadow-card overflow-hidden">
          <div className="relative px-4 py-3 border-b border-line pl-5">
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-600" />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-ink">Storage &amp; snapshot capability</h3>
              <span className="rounded-full border border-line bg-surface-sunken px-2 py-0.5 text-2xs font-semibold text-ink-muted">
                3/5
              </span>
            </div>
          </div>
          <p className="px-4 py-2.5 text-sm text-ink-muted bg-surface-sunken border-b border-line leading-relaxed">
            This section is where POCs are quietly won or lost.
          </p>
          <div className="border-l-2 border-l-brand-600 bg-brand-50/30 pl-4 pr-4 py-3">
            <div className="text-sm font-semibold text-ink">
              VolumeSnapshotClass annotated for Kasten
              <span className="ml-2 text-2xs font-bold uppercase tracking-wider text-red-700">Blocking</span>
            </div>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              Kasten selects a snapshot class by annotation. One annotated class covering one driver is a common POC
              state that breaks the moment a second storage backend appears.
            </p>
            <p className="text-xs text-ink-muted mt-1.5">
              <span className="font-semibold">Evidence of pass: </span>
              Each CSI driver in use has an annotated VolumeSnapshotClass.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-medium text-ink-muted">
                Storage &amp; security <span className="text-brand-700 font-semibold">L1</span>
              </span>
              <span className="text-xs font-semibold text-ink-muted">Verify &amp; note</span>
            </div>
            <span className="inline-block mt-2 rounded-md border border-ocean-500/30 bg-ocean-50 px-2 py-[3px] text-xs font-mono font-semibold text-ocean-700">
              kubectl
            </span>
          </div>
        </section>

        {/* Text ladder with measured ratios against the surface. */}
        <div className="mt-3 bg-surface border border-line rounded-card p-4">
          <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted mb-2">
            Text levels on surface
          </div>
          {(
            [
              ["ink", ramp.ink.ink, "Primary — item labels, headings"],
              ["ink-soft", ramp.ink.soft, "Body — list content"],
              ["ink-muted", ramp.ink.muted, "Secondary — the why and evidence lines"],
              ["ink-faint", ramp.ink.faint, "Faintest permitted — captions only"],
            ] as const
          ).map(([name, hex, use]) => (
            <div key={name} className="flex items-baseline gap-3 py-1 border-b border-line last:border-b-0">
              <span className="font-mono text-2xs w-20 shrink-0" style={{ color: hex }}>
                {name}
              </span>
              <span className="flex-1 text-sm" style={{ color: hex }}>
                {use}
              </span>
              <span
                className="font-mono text-2xs tabular-nums shrink-0"
                style={{ color: Number(ratio(hex)) >= 6 ? ramp.ink.soft : "#c0392b" }}
              >
                {ratio(hex)}:1
              </span>
            </div>
          ))}
        </div>

        {/* Raw swatches. */}
        <div className="mt-3 flex rounded-lg overflow-hidden border border-line">
          {Object.entries(ramp.scale).map(([k, v]) => (
            <div key={k} className="flex-1" title={`${k} — ${v}`}>
              <div className="h-10" style={{ background: v }} />
              <div className="text-center py-1 text-2xs font-mono text-ink-muted bg-surface">{k}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DesignPage() {
  const [side, setSide] = useState(true);

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-[86rem] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-lg font-semibold text-ink">Slate ramp comparison</h1>
            <p className="text-xs text-ink-muted">
              Design scratch route. Pick a ramp, copy its values into{" "}
              <code className="font-mono">globals.css</code>, then delete <code className="font-mono">app/design/</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSide(v => !v)}
            className="text-xs font-semibold text-ink-soft hover:text-brand-700 border border-line-strong rounded-lg px-3 py-2"
          >
            {side ? "Stack vertically" : "Show side by side"}
          </button>
        </div>
      </header>

      <main className="max-w-[86rem] mx-auto px-6 py-6">
        <div className={side ? "grid gap-5 lg:grid-cols-3 items-start" : "space-y-8 max-w-2xl"}>
          {RAMPS.map(r => (
            <div key={r.id}>
              <h2 className="font-display text-base font-semibold text-ink mb-1">{r.name}</h2>
              <p className="text-xs text-ink-muted mb-3 leading-relaxed">{r.rationale}</p>
              <Specimen ramp={r} />
            </div>
          ))}
        </div>

        <p className="text-xs text-ink-muted mt-8 max-w-2xl leading-relaxed">
          The gate badge and the brand green are identical in all three, deliberately: the question is which neutral the
          brand sits best against, and judging a green next to three different greys is the only way to answer it. Ratios
          are computed live against each ramp&apos;s own surface — anything below 6:1 is flagged red, since AA&apos;s
          4.5:1 floor proved too generous for 11–12px text.
        </p>
      </main>
    </div>
  );
}
