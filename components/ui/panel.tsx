import type { ReactNode } from "react";

// The card primitive.
//
// `bg-white rounded-xl border border-gray-200 shadow-sm p-6` appeared in six
// places before this existed, which is three more than the brief's threshold for
// extracting a component. Now the structural language lives here: one border
// weight, one radius, one shadow, one header rhythm.
//
// The visual target is instrumentation — Datadog, the AWS console — rather than
// a marketing surface. That means crisp hairline borders and flat surfaces
// carrying the structure, with depth used sparingly and only to lift things that
// are genuinely above the page.

export function Panel({
  children,
  className = "",
  raised = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** For surfaces that float above the page — modals, sticky bars. Not for content cards. */
  raised?: boolean;
  /** Anchor id, for in-page navigation. */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`bg-surface border border-line rounded-card overflow-hidden ${
        raised ? "shadow-raised" : "shadow-card"
      } ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Panel header.
 *
 * Three levels of information in a fixed rhythm, so the eye learns the pattern
 * once and then skips straight to whichever level it wants:
 *
 *   eyebrow  — where this sits in the wider model (roadmap phase, playbook §)
 *   title    — what it is
 *   action   — the one thing you can do from here
 *   meta     — counts and state, right-aligned
 *
 * `accent` draws a 2px brand rule down the left edge. That replaced a solid
 * green fill: four saturated bands per stage competed with the gate badge, which
 * is the single most important element on the page. A rule marks the boundary
 * without shouting.
 */
export function PanelHeader({
  eyebrow,
  title,
  action,
  meta,
  accent = false,
  onClick,
  expanded,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  meta?: ReactNode;
  accent?: boolean;
  /** When provided the whole header becomes the disclosure control. */
  onClick?: () => void;
  expanded?: boolean;
  className?: string;
}) {
  const inner = (
    <div className="flex items-start justify-between gap-4 w-full text-left">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted mb-1">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-base font-semibold text-ink leading-snug">{title}</h2>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {meta}
        {action}
        {onClick && (
          <svg
            className={`h-4 w-4 text-ink-muted transition-transform duration-150 ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.25}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
    </div>
  );

  const shell = `relative px-5 py-4 ${accent ? "pl-6" : ""} ${className}`;
  const rule = accent ? (
    <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-600" />
  ) : null;

  if (onClick) {
    return (
      <div className={`${shell} border-b border-line`}>
        {rule}
        <button
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          className="w-full cursor-pointer group"
        >
          {inner}
        </button>
      </div>
    );
  }

  return (
    <div className={`${shell} border-b border-line`}>
      {rule}
      {inner}
    </div>
  );
}

export function PanelBody({
  children,
  className = "",
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  /** No padding — for lists and tables that manage their own insets. */
  flush?: boolean;
}) {
  return <div className={`${flush ? "" : "px-5 py-4"} ${className}`}>{children}</div>;
}

/**
 * Explanatory prose at the top of a panel body. Sits on the sunken surface so it
 * reads as context rather than content, which matters when the panel below it is
 * a dense list a reader wants to get to.
 */
export function PanelIntro({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-3 text-sm text-ink-muted leading-relaxed bg-surface-sunken border-b border-line">
      {children}
    </p>
  );
}

/** Small count/state chip. Tabular figures so columns of them do not jitter. */
export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "warn" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-sunken text-ink-muted border-line",
    brand: "bg-brand-50 text-brand-800 border-brand-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold tabular-nums ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
