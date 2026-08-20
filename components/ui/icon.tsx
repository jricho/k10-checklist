// Icons as SVG, not as characters.
//
// The previous version used the characters for external-link, download, chevron,
// check and bullet inline. Those live in the Arrows, Dingbats and
// General Punctuation blocks, and `next/font` subsets Space Grotesk and Manrope
// to `latin` — so the glyphs are not in the font files that get downloaded. The
// browser silently substitutes a system font, which at best looks foreign in the
// middle of a word and at worst renders a tofu box. It is the same failure the
// PDF export already had to design around.
//
// Anything decorative and non-Latin is therefore drawn, and marked aria-hidden
// because in every case the adjacent words already carry the meaning.
//
// Two sizing conventions, deliberately:
//   - Inline icons (external link, download, chevron, check, alert) are sized in
//     `em` so they scale with the text they sit inside.
//   - Object icons (document, spreadsheet) take an explicit size with a default,
//     because they represent a thing rather than punctuating a sentence. Em
//     sizing made them scale off a 12px button label and read as specks.

type IconProps = { className?: string };

const base = "inline-block shrink-0 align-[-0.125em]";

export function ExternalLinkIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${base} h-[0.9em] w-[0.9em] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" />
      <path d="M14 4h6v6" />
      <path d="M20 4l-8.5 8.5" />
    </svg>
  );
}

export function DownloadIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${base} h-[0.9em] w-[0.9em] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v11" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${base} h-[0.9em] w-[0.9em] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function CheckIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${base} h-[0.95em] w-[0.95em] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4.5 4.5L19 7" />
    </svg>
  );
}

export function AlertIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${base} h-[0.95em] w-[0.95em] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v9" />
      <path d="M12 18.5v.5" />
    </svg>
  );
}

/**
 * Reference-document icons. Explicitly sized rather than em-relative — they are
 * objects, not text decoration — and drawn rather than borrowed from an icon font
 * so they inherit `currentColor` and survive font subsetting.
 *
 * Stroke is 1.6 rather than the 2.25 the inline icons use: weight has to come
 * down as an icon scales up, or a 28px glyph reads heavier than the type beside
 * it and pulls the eye off the title.
 *
 * Deliberately distinguishable at a glance: the document has a folded corner and
 * text rules, the spreadsheet has a grid. A reader scanning the masthead should
 * be able to tell the playbook from the workbook without reading the label.
 */
export function DocumentIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${base} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

export function SpreadsheetIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${base} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9.5h16M4 15h16M9.5 9.5V20M15 9.5V20" />
    </svg>
  );
}

/**
 * List marker. A drawn square rather than a `•`, so bullet weight and colour are
 * controllable and there is no dependency on a punctuation glyph surviving font
 * subsetting.
 */
export function Marker({ className = "" }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-1 w-1 rounded-[1px] mt-[0.5em] shrink-0 ${className}`}
    />
  );
}
