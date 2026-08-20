"use client";

import {
  RADAR_LEVELS,
  describeRadar,
  radarGeometry,
  toPolygonPoints,
  type RadarInput,
} from "../../lib/radar";

// The seven-dimension maturity chart, hand-rolled SVG.
//
// No charting dependency: seven axes and five rings is the trigonometry in
// lib/radar.ts, and a library would add a bundle, an API to learn and a second
// renderer that the PDF cannot use. The geometry module is shared with the
// export, so this component and the PDF page draw the same vertices.
//
// Two accessibility decisions that are not optional here. The chart carries
// `role="img"` with a full text description, because a polygon is not readable by
// a screen reader and this is the summary an infrastructure leader is shown. And
// every axis is labelled with its numeric level next to its name, so the position
// survives monochrome printing, colour blindness, and the moment someone
// screenshots it into a slide — shape and colour carry emphasis, never meaning.

// The viewBox is sized to contain the axis labels, not just the plot, and the
// centre is offset left of true centre to pay for it.
//
// The first version used a square box with `overflow-visible`, which let the
// labels paint outside the SVG and over the headline sitting in the next grid
// column. Nothing here may rely on overflow: the label anchors are computed at
// `radius + labelGap` from the centre and the text then extends up to ~85px
// further on a side axis, so that reach has to be inside the box.
//
// The axis at 167 degrees carries the longest label ("Observability L5") and
// points left, so it sets the left budget at ~201px from the centre; the
// rightward axes need ~152px. The centre therefore sits left of the box centre,
// at x=205 in a 400-wide box.
//
// These numbers are asserted rather than eyeballed — the verification pass
// measures every label's extent against the viewBox using a deliberately
// pessimistic 0.58em character width, so a pass there is a pass in the browser.
// An earlier 370-wide box with the centre at 188 overflowed on the left by 13px,
// which is exactly the sort of thing that looks fine until a dimension reaches L5.
const WIDTH = 400;
const HEIGHT = 240;
const RADIUS = 92;
const LABEL_GAP = 14;

export function MaturityRadar({ inputs }: { inputs: RadarInput[] }) {
  const geometry = radarGeometry(inputs, {
    radius: RADIUS,
    // y=124, not the box's vertical centre: the single top label needs less
    // clearance than the two bottom ones, which sit at 64 and 116 degrees and
    // carry a baseline shift downward.
    centre: { x: 205, y: 124 },
    labelGap: LABEL_GAP,
  });

  const description = describeRadar(inputs);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[400px] mx-auto"
        role="img"
        aria-label={`Maturity evidence radar. ${description}`}
      >
        {/* Rings. The outermost is drawn a shade stronger so the chart has an
            edge — without it the plot floats and the L5 boundary is guesswork. */}
        {geometry.rings.map(ring => (
          <polygon
            key={ring.level}
            points={toPolygonPoints(ring.polygon)}
            fill="none"
            className={ring.level === RADAR_LEVELS ? "stroke-line-strong" : "stroke-line"}
            strokeWidth={ring.level === RADAR_LEVELS ? 1.25 : 1}
          />
        ))}

        {/* Spokes, thickened by weight. Emphasis only — see RadarInput.weight. */}
        {geometry.axes.map(axis => (
          <line
            key={axis.key}
            x1={geometry.centre.x}
            y1={geometry.centre.y}
            x2={axis.tip.x}
            y2={axis.tip.y}
            className="stroke-line"
            strokeWidth={axis.emphasis * 0.7}
          />
        ))}

        {/* The plot. Degenerate at a fresh assessment, when every value is 0 and
            the polygon collapses to a point — a dot at the origin is the honest
            rendering of "nothing evidenced yet", so it is drawn rather than
            hidden, with the caption below saying so in words. */}
        {geometry.degenerate ? (
          <circle
            cx={geometry.centre.x}
            cy={geometry.centre.y}
            r={3.5}
            className="fill-ink-muted"
          />
        ) : (
          <>
            <polygon
              points={toPolygonPoints(geometry.polygon)}
              className="fill-brand-600/20 stroke-brand-700"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {geometry.axes.map(axis => (
              <circle
                key={axis.key}
                cx={axis.point.x}
                cy={axis.point.y}
                r={axis.value > 0 ? 3 : 2}
                className={axis.value > 0 ? "fill-brand-700" : "fill-ink-muted"}
              />
            ))}
          </>
        )}

        {/* Ring numerals, on the upward axis only. Repeating them on all seven
            spokes turns the centre of the chart into noise. */}
        {geometry.rings.map(ring => (
          <text
            key={`n${ring.level}`}
            x={geometry.centre.x + 4}
            y={geometry.centre.y - ring.radius + 3.5}
            className="fill-ink-muted font-mono"
            fontSize={8}
          >
            {ring.level}
          </text>
        ))}

        {/* Axis labels: name, then the level as a numeral. The numeral is the
            reason this chart is legible in greyscale. */}
        {geometry.axes.map(axis => (
          <text
            key={`l${axis.key}`}
            x={axis.labelPoint.x}
            y={axis.labelPoint.y}
            textAnchor={axis.align}
            dy={`${axis.baselineShift}em`}
            fontSize={10.5}
            className="fill-ink-soft"
          >
            {axis.label}
            <tspan className="fill-ink font-semibold" fontSize={10.5}>
              {" "}
              L{axis.value}
            </tspan>
          </text>
        ))}
      </svg>

      <figcaption className="text-[11px] text-ink-muted leading-relaxed mt-1 text-center max-w-[340px] mx-auto">
        {geometry.degenerate
          ? "Nothing evidenced yet — the plot sits at the centre on all seven axes."
          : "Each axis plots the highest level with no outstanding item below it. Spoke thickness reflects how many blocking items a dimension carries; it never changes a plotted level."}
      </figcaption>
    </figure>
  );
}
