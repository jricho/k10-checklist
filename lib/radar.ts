// Radar geometry, as pure arithmetic.
//
// This module exists so the on-screen SVG and the PDF are the same chart rather
// than two charts that resemble each other. Seven axes and five rings is
// trigonometry, not a charting library, and the trigonometry lives here once:
// `components/checklist/maturity-radar.tsx` turns these coordinates into SVG,
// `lib/export-pdf.ts` turns the identical coordinates into jsPDF line
// primitives. If the two ever disagree, it is a bug in one renderer and not a
// difference of opinion between them.
//
// Why a hand-drawn jsPDF twin rather than rasterising the SVG: jsPDF cannot
// render DOM or SVG, so the alternative is canvas-to-PNG, which needs a live
// node in the document. A customer who exports without ever opening the maturity
// panel would get a PDF with the chart silently missing — and the export is the
// artefact this tool exists to produce. Vector also stays crisp at print size.
//
// Nothing here knows about React, jsPDF, colour or units. Distances are in
// whatever unit the caller passes: CSS pixels on screen, millimetres in the PDF.

export const RADAR_LEVELS = 5;

export interface RadarInput {
  /** Stable key — dimension id. Used for React keys and for debugging parity. */
  key: string;
  /** Short label drawn outside the outer ring. */
  label: string;
  /**
   * Evidenced level, 0–5. Plotted as-is.
   *
   * Deliberately not averaged, interpolated or rounded up. A dimension sitting at
   * L2 because one L2 item is outstanding plots at 2 however many L4 items are
   * passing — the panel beside the chart names those items, and a chart that
   * flattered the position would contradict it.
   */
  value: number;
  /**
   * Relative consequence of this dimension — the count of blocking items tagged
   * to it. Used for emphasis only.
   *
   * Weight deliberately does not touch radius or angle. The obvious reading of
   * "weight sizes the radar" is an angular sector per dimension, which was
   * rejected: it makes the same evidenced level enclose different areas on
   * different axes, and an area that cannot be compared across axes is
   * decoration on the one summary that has to be read at a glance. Equal angles
   * keep the polygon honest; weight shows up as spoke thickness and a label
   * annotation instead.
   */
  weight: number;
}

export interface RadarPoint {
  x: number;
  y: number;
}

export interface RadarAxisGeometry extends RadarInput {
  index: number;
  /** Radians, measured from the positive x-axis. First axis points straight up. */
  angle: number;
  /** Where the axis meets the outer ring. */
  tip: RadarPoint;
  /** Where this dimension's value sits on the axis. Equals the centre when value is 0. */
  point: RadarPoint;
  /** Anchor for the label text, outside the outer ring. */
  labelPoint: RadarPoint;
  /** Text alignment appropriate to the label's side of the chart. */
  align: "start" | "middle" | "end";
  /** Vertical nudge for the label, in multiples of the caller's font size. */
  baselineShift: number;
  /** Stroke width multiplier from weight, clamped to a legible range. */
  emphasis: number;
}

export interface RadarGeometry {
  centre: RadarPoint;
  radius: number;
  /** Concentric level polygons, innermost first. */
  rings: { level: number; radius: number; polygon: RadarPoint[] }[];
  axes: RadarAxisGeometry[];
  /** The plotted shape. One vertex per axis, in axis order. */
  polygon: RadarPoint[];
  /** True when every value is 0 — the polygon collapses to the centre. */
  degenerate: boolean;
}

export interface RadarOptions {
  /** Distance from centre to the outer ring. */
  radius: number;
  centre: RadarPoint;
  /** Gap between the outer ring and the label anchor. */
  labelGap?: number;
}

function pointOn(centre: RadarPoint, angle: number, distance: number): RadarPoint {
  return {
    x: centre.x + Math.cos(angle) * distance,
    y: centre.y + Math.sin(angle) * distance,
  };
}

/**
 * Where a value sits on an axis.
 *
 * Level 0 sits at the centre rather than on an inner ring. That is a claim worth
 * making explicitly: 0 means "no level's evidence is complete", which is
 * genuinely the origin and not a small amount of progress.
 */
function radiusForValue(value: number, radius: number): number {
  const clamped = Math.max(0, Math.min(RADAR_LEVELS, value));
  return (clamped / RADAR_LEVELS) * radius;
}

export function radarGeometry(inputs: RadarInput[], opts: RadarOptions): RadarGeometry {
  const { radius, centre } = opts;
  const labelGap = opts.labelGap ?? radius * 0.14;
  const n = inputs.length;
  const step = (Math.PI * 2) / n;
  // Start at the top so the first dimension reads as the "twelve o'clock" axis,
  // matching the row order of the self-assessment workbook.
  const first = -Math.PI / 2;

  const maxWeight = Math.max(1, ...inputs.map(i => i.weight));

  const axes: RadarAxisGeometry[] = inputs.map((input, index) => {
    const angle = first + index * step;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      ...input,
      index,
      angle,
      tip: pointOn(centre, angle, radius),
      point: pointOn(centre, angle, radiusForValue(input.value, radius)),
      labelPoint: pointOn(centre, angle, radius + labelGap),
      align: cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle",
      // Labels directly above or below the chart need lifting off the ring;
      // ones to the side are already clear of it.
      baselineShift: sin < -0.75 ? -0.2 : sin > 0.75 ? 0.9 : 0.35,
      // 1.0 at the lightest, 2.2 at the heaviest. Bounded because an unbounded
      // ratio would make the thinnest spoke invisible in the PDF.
      emphasis: 1 + 1.2 * (input.weight / maxWeight),
    };
  });

  const rings = Array.from({ length: RADAR_LEVELS }, (_, i) => {
    const level = i + 1;
    const r = (level / RADAR_LEVELS) * radius;
    return {
      level,
      radius: r,
      polygon: axes.map(a => pointOn(centre, a.angle, r)),
    };
  });

  return {
    centre,
    radius,
    rings,
    axes,
    polygon: axes.map(a => a.point),
    degenerate: inputs.every(i => i.value <= 0),
  };
}

/** `M x y L x y … Z` for an SVG path. */
export function toPath(points: RadarPoint[]): string {
  if (points.length === 0) return "";
  return (
    points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z"
  );
}

/** `x,y x,y …` for an SVG `points` attribute. */
export function toPolygonPoints(points: RadarPoint[]): string {
  return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/**
 * Vertex-to-vertex deltas, for jsPDF's `lines()`, which draws relative segments
 * from a starting point rather than taking absolute coordinates.
 */
export function toRelativeSegments(points: RadarPoint[]): number[][] {
  const out: number[][] = [];
  for (let i = 1; i < points.length; i++) {
    out.push([points[i].x - points[i - 1].x, points[i].y - points[i - 1].y]);
  }
  return out;
}

/**
 * The chart in words.
 *
 * Not a fallback — an equal. Meaning must never be carried by shape alone: a
 * screen reader user, a monochrome print and a colourblind auditor all need the
 * position stated, and the PDF is read by all three.
 */
export function describeRadar(inputs: RadarInput[]): string {
  if (inputs.every(i => i.value <= 0)) {
    return `No dimension yet has a complete level of evidence, so the chart plots at the centre on all ${inputs.length} axes.`;
  }
  const parts = inputs.map(i => `${i.label} L${i.value}`);
  const weakest = [...inputs].sort((a, b) => a.value - b.value)[0];
  return `Evidenced level by dimension: ${parts.join(", ")}. Weakest: ${weakest.label} at L${weakest.value}.`;
}
