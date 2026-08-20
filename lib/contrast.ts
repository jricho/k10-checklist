// WCAG contrast maths.
//
// Extracted because this codebase makes a lot of contrast claims — the ink ramp,
// the brand ramp, the amber gate badge, the radar's ring numerals over a tinted
// fill — and every one of them was previously a number in a comment that nobody
// could recompute. A ratio in a comment is a claim; a ratio from this module is a
// measurement.
//
// Pure functions, no DOM, so `/design` can print ratios at render time and the
// verification pass can assert them without a browser.

export type Rgb = [number, number, number];

/** `#rgb` or `#rrggbb` to channel bytes. Throws rather than guessing. */
export function parseHex(hex: string): Rgb {
  const s = hex.trim().replace(/^#/, "");
  const full = s.length === 3 ? s.split("").map(c => c + c).join("") : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** sRGB relative luminance, per WCAG 2.x. */
export function luminance(colour: Rgb | string): number {
  const [r, g, b] = typeof colour === "string" ? parseHex(colour) : colour;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio, always >= 1, order-independent. */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Rounded to two places, for printing. */
export function ratio(a: Rgb | string, b: Rgb | string): string {
  return `${contrastRatio(a, b).toFixed(2)}:1`;
}

export type WcagVerdict = "AAA" | "AA" | "AA Large" | "UI only" | "fail";

/**
 * The band a ratio falls into.
 *
 * "UI only" is the 3:1 tier: enough for a non-text indicator or a component
 * boundary, not enough for text of any size. It is called out separately because
 * conflating it with AA Large is how a 3.6:1 badge with white text shipped on the
 * loudest element on the page.
 */
export function verdict(r: number): WcagVerdict {
  if (r >= 7) return "AAA";
  if (r >= 4.5) return "AA";
  if (r >= 3) return "AA Large";
  return "fail";
}

/**
 * Whether a surface boundary is perceptible without a border.
 *
 * Not a WCAG rule — WCAG has nothing to say about a card edge against a page.
 * The threshold is a working convention: below roughly 1.2:1 a fill boundary is
 * not reliably visible on a cheap panel in a bright meeting room, so the design
 * must carry the edge with a border or a shadow instead of relying on the fill.
 */
export function boundaryIsSelfEvident(surface: string, page: string): boolean {
  return contrastRatio(surface, page) >= 1.2;
}
