"use client";

// PDF export.
//
// Extracted from the page component for three reasons: it was the largest single
// block of logic in a file that also owned all the UI; jsPDF is ~150 KB that no
// longer needs to be in the first-load bundle now that it is imported inside the
// handler; and the original page-break arithmetic used three different magic
// bottom limits (260, 270, 282) with the cursor advanced by hand at each call
// site, which is how content ends up clipped at the foot of a page.
//
// The `PdfWriter` below owns the cursor. Every write goes through a helper that
// asks for the space it needs first, so a page break can never land inside a
// block. Adding a section to the export no longer means getting the maths right.

import type { Assessment } from "./checklist-state";
import {
  DIMENSIONS,
  ocCommandFor,
  progressForStage,
  STAGES,
  STAGE_ORDER,
  statusOf,
  type ChecklistItem,
  type ItemStatus,
  type StageId,
} from "./checklist-data";
import { maturityEvidence } from "./maturity";
import { describeTier, tierWarnings } from "./architecture";

const VEEAM_GREEN: [number, number, number] = [33, 145, 80];
const INK: [number, number, number] = [50, 50, 50];
const MUTED: [number, number, number] = [110, 110, 110];
const RED: [number, number, number] = [190, 45, 45];
const AMBER: [number, number, number] = [190, 130, 20];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_L = 12;
const MARGIN_R = 12;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const CONTENT_TOP = 30;
const CONTENT_BOTTOM = 278;

/**
 * Captured diagnostic output is truncated before it reaches the PDF.
 *
 * A Popeye report or a cluster-info dump can run to tens of thousands of lines.
 * The original export looped over every one at 3.5 mm per line, which turns a
 * large paste into a several-hundred-page PDF and freezes the tab while it is
 * generated. A change record needs the evidence, not the entire transcript — the
 * full text stays available in the browser and in the source file.
 */
const MAX_OUTPUT_LINES = 400;

type Rgb = [number, number, number];

/** Minimal surface of jsPDF that this module uses, so the dynamic import stays typed. */
interface JsPdfLike {
  setFillColor(r: number, g: number, b: number): void;
  setTextColor(r: number, g: number, b: number): void;
  setFontSize(size: number): void;
  setFont(family: string, style?: string): void;
  setDrawColor(r: number, g: number, b: number): void;
  rect(x: number, y: number, w: number, h: number, style?: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  text(text: string | string[], x: number, y: number, options?: { align?: string }): void;
  splitTextToSize(text: string, width: number): string[];
  addPage(): void;
  setPage(n: number): void;
  getNumberOfPages(): number;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): void;
  save(filename: string): void;
}

class PdfWriter {
  private y = CONTENT_TOP;

  constructor(private doc: JsPdfLike) {}

  /** Reserve vertical space, breaking the page first if the block will not fit. */
  private reserve(height: number) {
    if (this.y + height > CONTENT_BOTTOM) {
      this.doc.addPage();
      this.y = CONTENT_TOP;
    }
  }

  get cursor() {
    return this.y;
  }

  newPage() {
    this.doc.addPage();
    this.y = CONTENT_TOP;
  }

  /** Green title band. Used on the cover and at the top of each major section page. */
  banner(title: string, subtitle?: string) {
    this.doc.setFillColor(...VEEAM_GREEN);
    this.doc.rect(0, 0, PAGE_W, 22, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(15);
    this.doc.text(title, MARGIN_L, 13);
    if (subtitle) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.text(subtitle, MARGIN_L, 18.5);
    }
    this.y = CONTENT_TOP;
  }

  sectionHeading(text: string, badge?: string) {
    this.reserve(14);
    this.doc.setFillColor(...VEEAM_GREEN);
    this.doc.rect(MARGIN_L - 4, this.y - 4.5, CONTENT_W + 8, 8, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text(text, MARGIN_L, this.y + 1);
    if (badge) {
      this.doc.setFontSize(9);
      this.doc.text(badge, PAGE_W - MARGIN_R, this.y + 1, { align: "right" });
    }
    this.y += 11;
  }

  subHeading(text: string) {
    this.reserve(10);
    this.doc.setTextColor(...VEEAM_GREEN);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.text(text, MARGIN_L, this.y);
    this.y += 6;
  }

  /** Wrapped body text. Returns the height consumed. */
  paragraph(text: string, opts: { size?: number; colour?: Rgb; indent?: number; style?: string } = {}) {
    const { size = 9, colour = INK, indent = 0, style = "normal" } = opts;
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...colour);
    const lines = this.doc.splitTextToSize(text, CONTENT_W - indent);
    const lineHeight = size * 0.42;
    this.reserve(lines.length * lineHeight + 1.5);
    this.doc.text(lines, MARGIN_L + indent, this.y);
    this.y += lines.length * lineHeight + 1.5;
  }

  keyValue(label: string, value: string) {
    this.reserve(6);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...INK);
    this.doc.text(label, MARGIN_L, this.y);
    this.doc.setFont("helvetica", "normal");
    const lines = this.doc.splitTextToSize(value || "—", CONTENT_W - 45);
    this.doc.text(lines, MARGIN_L + 45, this.y);
    this.y += Math.max(5, lines.length * 4);
  }

  /**
   * Monospaced command text on a light background.
   *
   * Long commands are wrapped by jsPDF rather than clipped — a truncated command
   * in an evidence pack is worse than no command, because someone will run it.
   */
  mono(text: string, opts: { label?: string; indent?: number } = {}) {
    const { label, indent = 4 } = opts;
    this.doc.setFont("courier", "normal");
    this.doc.setFontSize(7.5);
    const lines = this.doc.splitTextToSize(text, CONTENT_W - indent - 14);
    this.reserve(lines.length * 3.2 + 3);
    if (label) {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(6.5);
      this.doc.setTextColor(...MUTED);
      this.doc.text(label, MARGIN_L + indent, this.y);
      this.doc.setFont("courier", "normal");
      this.doc.setFontSize(7.5);
    }
    this.doc.setTextColor(70, 70, 70);
    this.doc.text(lines, MARGIN_L + indent + 13, this.y);
    this.y += lines.length * 3.2 + 2;
  }

  rule() {
    this.reserve(4);
    this.doc.setDrawColor(220, 220, 220);
    this.doc.line(MARGIN_L, this.y, PAGE_W - MARGIN_R, this.y);
    this.y += 4;
  }

  space(h = 3) {
    this.reserve(h);
    this.y += h;
  }

  /** Preformatted block, line by line, with a hard cap on length. */
  preformatted(text: string) {
    this.doc.setFont("courier", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...INK);
    const all = text.split("\n").flatMap(line => this.doc.splitTextToSize(line || " ", CONTENT_W));
    const shown = all.slice(0, MAX_OUTPUT_LINES);
    for (const line of shown) {
      this.reserve(3.1);
      this.doc.text(line, MARGIN_L, this.y);
      this.y += 3.1;
    }
    if (all.length > shown.length) {
      this.space(2);
      this.paragraph(
        `[truncated for this export — ${all.length - shown.length} further lines omitted. The full capture is retained in the source file.]`,
        { size: 7.5, colour: MUTED, style: "italic" },
      );
    }
  }

  image(dataUrl: string, dims: { w: number; h: number }) {
    const maxW = CONTENT_W;
    const maxH = CONTENT_BOTTOM - CONTENT_TOP - 10;
    const scale = Math.min(maxW / dims.w, maxH / dims.h);
    const w = dims.w * scale;
    const h = dims.h * scale;
    const format = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    this.doc.addImage(dataUrl, format, (PAGE_W - w) / 2, this.y, w, h);
    this.y += h + 4;
  }
}

/**
 * Status marker.
 *
 * Not "✓" and "○": jsPDF's built-in helvetica is WinAnsi-encoded and has no
 * glyph for U+2713 or U+25CB, so the original export rendered those as blank or
 * as mojibake in the one artefact that goes to auditors. ASCII markers survive
 * every viewer, and the colour carries the emphasis.
 */
function marker(status: ItemStatus): { text: string; colour: Rgb } {
  switch (status) {
    case "pass":
      return { text: "[PASS]", colour: VEEAM_GREEN };
    case "fail":
      return { text: "[FAIL]", colour: RED };
    case "na":
      return { text: "[ N/A]", colour: MUTED };
    default:
      return { text: "[    ]", colour: AMBER };
  }
}

/**
 * How much of the journey the export covers.
 *
 *  - "stage"   just the selected stage. The artefact for a single gate: a POC
 *              sign-off should not carry 82 unanswered Pre-Production and Day-2
 *              items, because a reader cannot tell "not applicable yet" from
 *              "we skipped it".
 *  - "through" the selected stage and everything before it. The right choice for
 *              a go-live change record, since a stage's gate includes upstream
 *              blockers — a Go-Live PDF that omits the POC restore evidence is
 *              missing the part an auditor cares about.
 *  - "all"     the full four-stage record.
 */
export type ExportScope = "stage" | "through" | "all";

export const EXPORT_SCOPE_LABELS: Record<ExportScope, string> = {
  stage: "This stage only",
  through: "This stage and earlier",
  all: "All four stages",
};

export interface ExportInput {
  assessment: Assessment;
  diagram?: { dataUrl: string; name: string; dims: { w: number; h: number } } | null;
  /** Defaults to "through" — the useful default for a gate sign-off. */
  scope?: ExportScope;
}

function stagesInScope(scope: ExportScope, active: StageId) {
  if (scope === "all") return STAGES;
  const activeIndex = STAGE_ORDER.indexOf(active);
  if (scope === "stage") return STAGES.filter(s => s.id === active);
  return STAGES.filter(s => STAGE_ORDER.indexOf(s.id) <= activeIndex);
}

export async function exportAssessmentPdf({
  assessment,
  diagram,
  scope = "through",
}: ExportInput): Promise<void> {
  // Dynamic import: jsPDF is only needed when the button is pressed, so it stays
  // out of the initial page bundle.
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF() as unknown as JsPdfLike;
  const w = new PdfWriter(doc);
  const { meta, statuses, notes, outputs, activeStage } = assessment;
  const included = stagesInScope(scope, activeStage);
  const includedIds = new Set(included.map(s => s.id));
  const activeStageName = STAGES.find(s => s.id === activeStage)?.name ?? "";

  // ---------------------------------------------------------------- cover page
  w.banner(
    "Veeam Kasten — Readiness & Operating Maturity",
    scope === "all"
      ? "POC → Pre-Production → Go-Live → Day-2 Operations"
      : scope === "stage"
        ? `${activeStageName} — stage gate`
        : `Through ${activeStageName}`,
  );

  w.keyValue("Project", meta.project);
  w.keyValue("Environment", meta.environment);
  w.keyValue("Cluster", meta.clusterName);
  w.keyValue("Assessor", meta.assessor);
  w.keyValue("Date", meta.date);
  w.space(2);

  w.subHeading("Journey position");
  for (const stage of STAGES) {
    const p = progressForStage(stage.id, statuses);
    const gateText =
      p.gate === "clear"
        ? "GATE CLEAR"
        : p.gate === "blocked"
          ? `BLOCKED — ${p.upstreamBlockers.length} upstream blocker(s)`
          : `${p.blockersOutstanding.length} blocking item(s) outstanding`;
    w.keyValue(
      stage.name,
      `${p.passed}/${p.applicable} verified (${p.percent}%)${p.na ? `, ${p.na} N/A` : ""}${p.failed ? `, ${p.failed} failed` : ""} — ${gateText}${includedIds.has(stage.id) ? "" : "   [detail not in this export]"}`,
    );
  }

  // The whole journey is always summarised even when the detail is scoped, so a
  // reader of a POC-only PDF can still see that three stages remain ahead rather
  // than mistaking the document for the complete picture.
  if (scope !== "all") {
    w.space(1);
    w.paragraph(
      `Detail in this export: ${included.map(s => s.name).join(", ")}. Counts above cover the full journey.`,
      { size: 8, colour: MUTED, style: "italic" },
    );
  }

  w.space(2);
  w.subHeading("Workload tiers & DR topology");
  if (assessment.tiers.length === 0) {
    w.paragraph("No workload tiers defined.", { colour: MUTED });
  } else {
    for (const tier of assessment.tiers) {
      w.keyValue(tier.name.trim() || "(unnamed tier)", describeTier(tier));
      if (tier.notes.trim()) {
        w.paragraph(tier.notes.trim(), { size: 8, indent: 45, colour: MUTED, style: "italic" });
      }
    }
    // Printed rather than suppressed: an unresolved mismatch between a stated RTO
    // and the chosen topology is exactly the thing a reviewer should see before
    // signing, not something the tool should quietly hide because it is untidy.
    const warnings = tierWarnings(assessment.tiers).filter(x => x.severity === "warn");
    if (warnings.length > 0) {
      w.space(1);
      for (const warning of warnings) {
        w.paragraph(`!  ${warning.text}`, { size: 8, colour: AMBER, indent: 2 });
      }
    }
  }
  if (meta.rtoRpoNotes.trim()) {
    w.space(1);
    w.paragraph(meta.rtoRpoNotes.trim(), { size: 8.5 });
  }

  w.space(2);
  w.subHeading("Sign-off");
  w.keyValue("Platform", meta.signoffPlatform);
  w.keyValue("Security / Compliance", meta.signoffSecurity);
  w.keyValue("Workload owner", meta.signoffWorkloadOwner);

  w.space(3);
  w.subHeading("Reference documents");
  w.paragraph(
    "The Kasten Resilience Playbook (kasten-resilience-playbook.pdf) — the maturity model, day-2 operating model and reference architecture this checklist is built from. Each stage cites the sections it draws on.",
    { size: 8, indent: 2 },
  );
  w.paragraph(
    "Kasten Maturity Self-Assessment (kasten-maturity-self-assessment.xlsx) — the scoring workbook. Both ship with this tool and are linked from its Reference row.",
    { size: 8, indent: 2 },
  );

  w.space(2);
  w.paragraph(
    "This document records verification performed against a specific cluster on the date above. Items marked N/A are decisions, not omissions — each should have a recorded reason. Items marked FAIL are known, accepted gaps at the time of signing.",
    { size: 8, colour: MUTED, style: "italic" },
  );

  // ------------------------------------------------------------- stage detail
  for (const stage of included) {
    const p = progressForStage(stage.id, statuses);
    w.newPage();
    w.banner(stage.name, stage.roadmapPhase);

    w.paragraph(stage.goal, { size: 9.5 });
    w.space(1);
    w.paragraph(`Maturity: ${stage.maturityTarget}`, { size: 8.5, colour: MUTED });
    if (stage.playbookRefs?.length) {
      w.paragraph(`Playbook: ${stage.playbookRefs.join("  ·  ")}`, { size: 8, colour: MUTED });
    }
    w.space(1);
    w.subHeading("Exit criteria");
    for (const c of stage.exitCriteria) {
      w.paragraph(`•  ${c}`, { size: 8.5, indent: 2 });
    }

    if (p.blockersOutstanding.length > 0) {
      w.space(2);
      w.subHeading("Outstanding blocking items");
      for (const item of p.blockersOutstanding) {
        w.paragraph(`•  ${item.label}`, { size: 8.5, indent: 2, colour: RED });
      }
    }
    w.space(2);

    for (const section of stage.sections) {
      const done = section.items.filter(i => {
        const s = statusOf(statuses, i.id);
        return s === "pass" || s === "na";
      }).length;
      w.sectionHeading(section.title, `${done}/${section.items.length}`);
      if (section.intro) {
        w.paragraph(section.intro, { size: 8, colour: MUTED, style: "italic" });
        w.space(1);
      }

      for (const item of section.items) {
        writeItem(w, doc, item, statuses, notes);
      }
      w.space(2);
    }
  }

  // -------------------------------------------------- maturity signals page(s)
  w.newPage();
  w.banner(
    "Maturity signals observed",
    "Evidence for transcription into the Kasten Maturity Self-Assessment workbook",
  );

  w.paragraph(
    "This page reports what this checklist verified, mapped onto the seven dimensions of the Kasten Maturity Model. It is evidence, not a score: roughly half of each dimension's descriptor concerns process, ownership and cadence that no command can observe, so the companion workbook remains the authoritative instrument. Use the evidenced level as the starting point for the workbook's Current Level column, then adjust on judgement — and use the outstanding items as the concrete work that would justify the next level.",
    { size: 8.5 },
  );
  if (scope !== "all") {
    w.paragraph(
      "Maturity evidence is computed across the whole checklist, not just the stages detailed above, so some items named below appear in stages not included in this export.",
      { size: 8, colour: MUTED, style: "italic" },
    );
  }
  w.space(2);

  for (const ev of maturityEvidence(statuses)) {
    w.sectionHeading(
      DIMENSIONS[ev.dimension].name,
      ev.evidencedLevel > 0 ? `Evidence supports L${ev.evidencedLevel}` : "No level fully evidenced",
    );
    w.paragraph(
      `${ev.passedCount} of ${ev.taggedCount} associated checklist items verified.`,
      { size: 8, colour: MUTED },
    );

    if (ev.blockingNextLevel.length > 0 && ev.nextLevel) {
      w.paragraph(`To evidence Level ${ev.nextLevel}, close:`, { size: 8.5, style: "bold" });
      for (const item of ev.blockingNextLevel) {
        const s = statusOf(statuses, item.id);
        const m = marker(s);
        w.paragraph(`${m.text}  ${item.label}`, { size: 8, indent: 3, colour: s === "fail" ? RED : INK });
      }
    } else if (ev.evidencedLevel === 5) {
      w.paragraph("All associated items verified. Sustaining practices apply — reassess annually.", {
        size: 8,
        indent: 3,
      });
    }
    w.space(2);
  }

  w.space(2);
  w.paragraph(
    "Next step: open kasten-maturity-self-assessment.xlsx — downloadable from the Maturity panel of this tool, or served at /kasten-maturity-self-assessment.xlsx. On its Self-Assessment sheet (the second tab), record Current Level and Target Level for each of the seven dimensions above, then use the Recommendations tab for the level-transition actions. Reassess at least annually, or after any incident, drill, fleet change or new regulatory requirement.",
    { size: 8.5, style: "italic", colour: MUTED },
  );

  // ------------------------------------------------------- architecture diagram
  if (diagram) {
    w.newPage();
    w.banner("Cluster architecture", `Source: ${diagram.name}`);
    w.image(diagram.dataUrl, diagram.dims);
  }

  // ---------------------------------------------------------- captured output
  const captures: { title: string; content: string }[] = [
    { title: "Pre-flight primer", content: outputs.primer },
    { title: "Cluster information", content: outputs.cluster },
    { title: "Kasten policy & profile state", content: outputs.policies },
    { title: "Cluster sanitizer (Popeye)", content: outputs.popeye },
  ].filter(c => c.content.trim().length > 0);

  for (const capture of captures) {
    w.newPage();
    w.banner("Captured output", capture.title);
    w.preformatted(capture.content);
  }

  // ----------------------------------------------------------------- footers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${meta.project || "Veeam Kasten readiness"} — ${meta.date}`,
      MARGIN_L,
      PAGE_H - 8,
    );
    doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN_R, PAGE_H - 8, { align: "right" });
  }

  const slug = meta.project ? meta.project.trim().replace(/\s+/g, "-").toLowerCase() + "-" : "";
  const scopeSlug = scope === "all" ? "full-journey" : scope === "stage" ? activeStage : `through-${activeStage}`;
  doc.save(`kasten-readiness-${slug}${scopeSlug}-${meta.date}.pdf`);
}

function writeItem(
  w: PdfWriter,
  doc: JsPdfLike,
  item: ChecklistItem,
  statuses: Record<string, ItemStatus>,
  notes: Record<string, string>,
) {
  const status = statusOf(statuses, item.id);
  const m = marker(status);

  w.space(1);
  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...m.colour);
  doc.text(m.text, MARGIN_L, w.cursor);

  w.paragraph(`${item.label}${item.blocking ? "   (blocking)" : ""}`, {
    size: 9,
    style: "bold",
    indent: 16,
  });
  w.paragraph(item.why, { size: 7.8, indent: 16, colour: INK });
  w.paragraph(`Evidence: ${item.evidence}`, { size: 7.8, indent: 16, colour: MUTED });

  const note = notes[item.id]?.trim();
  if (note) {
    w.paragraph(`Note: ${note}`, { size: 7.8, indent: 16, style: "italic" });
  }

  if (item.cmd) {
    w.mono(item.cmd, { label: "kubectl", indent: 16 });
    const oc = ocCommandFor(item);
    if (oc && oc !== item.cmd) w.mono(oc, { label: "oc", indent: 16 });
  }
  w.rule();
}

/** Convenience for the JSON download button. */
export function downloadJson(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type { StageId };
