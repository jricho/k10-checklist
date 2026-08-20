"use client";

import { useState } from "react";
import { CommandBlock } from "../ui/command-block";
import { StatusToggle } from "../ui/status-toggle";
import { Chip, Panel, PanelHeader, PanelIntro } from "../ui/panel";
import {
  DIMENSIONS,
  ocCommandFor,
  statusOf,
  type ChecklistItem,
  type ChecklistSection,
  type ItemStatus,
  type StatusMap,
} from "../../lib/checklist-data";

/**
 * Status is carried on the left edge of the row rather than as a background
 * tint across the whole row.
 *
 * With up to eleven items per section, full-row tints turned the page into
 * bands of pale green and pink — pretty at three rows, candy at ninety, and
 * loud enough to compete with the gate badge that has to dominate. A 2px edge
 * scans just as fast down a column, keeps the text on a plain surface where it
 * is most legible, and leaves the saturated colour budget for the gate.
 *
 * Colour is never the only signal: the toggle itself always shows which state
 * is selected in words.
 */
const STATUS_EDGE: Record<ItemStatus, string> = {
  pass: "border-l-brand-600 bg-brand-50/30",
  fail: "border-l-red-500 bg-red-50/30",
  na: "border-l-line-strong bg-surface-sunken/60",
  pending: "border-l-transparent",
};

function ItemRow({
  item,
  status,
  note,
  onStatus,
  onNote,
}: {
  item: ChecklistItem;
  status: ItemStatus;
  note: string;
  onStatus: (status: ItemStatus) => void;
  onNote: (note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const oc = ocCommandFor(item);
  const needsNote = status === "na" || status === "fail";

  return (
    <li
      className={`border-l-2 pl-4 pr-5 py-3.5 transition-colors ${STATUS_EDGE[status]} ${
        status === "pending" ? "hover:bg-surface-sunken/70" : ""
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={`text-sm font-semibold leading-snug ${
                status === "na" ? "text-ink-faint" : "text-ink"
              }`}
            >
              {item.label}
            </span>
            {item.blocking && (
              <span
                title="Blocking: this stage cannot be signed off until this item passes or is ruled N/A"
                className="text-2xs font-bold uppercase tracking-wider text-red-700"
              >
                Blocking
              </span>
            )}
            {item.conditional && (
              <span
                title="Frequently N/A — mark N/A with a reason if it does not apply here"
                className="text-2xs font-medium uppercase tracking-wider text-ink-faint"
              >
                May be N/A
              </span>
            )}
          </div>

          <p className="text-sm text-ink-muted mt-1 leading-relaxed max-w-3xl">{item.why}</p>

          <p className="text-xs text-ink-faint mt-1.5 max-w-3xl">
            <span className="font-semibold text-ink-muted">Evidence of pass: </span>
            {item.evidence}
          </p>

          <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-2">
            {item.signals.map(([dim, level]) => (
              <span
                key={`${dim}-${level}`}
                title={`Evidence for Level ${level} of ${DIMENSIONS[dim].name} in the Kasten Maturity Model`}
                className="text-2xs font-medium text-ink-muted"
              >
                {DIMENSIONS[dim].short}
                <span className="text-brand-700 font-semibold"> L{level}</span>
              </span>
            ))}
            {item.docs?.map(d => (
              <a
                key={d.url}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xs font-medium text-brand-700 hover:underline"
              >
                {d.label} ↗
              </a>
            ))}
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-expanded={open}
              className="text-2xs font-semibold text-ink-faint hover:text-brand-700 transition-colors"
            >
              {open ? "Hide" : item.cmd ? "Verify & note" : "Add note"}
            </button>
          </div>
        </div>

        <div className="shrink-0">
          <StatusToggle status={status} onChange={onStatus} itemLabel={item.label} />
        </div>
      </div>

      {(open || needsNote) && (
        <div className="mt-3 space-y-2">
          {item.cmd && (
            <div className="space-y-2">
              <CommandBlock command={item.cmd} label="kubectl" />
              {oc && oc !== item.cmd && <CommandBlock command={oc} label="oc" tone="oc" />}
            </div>
          )}
          <div>
            <label htmlFor={`note-${item.id}`} className="block text-2xs font-medium text-ink-faint mb-1">
              {needsNote
                ? status === "na"
                  ? "Why does this not apply? (printed in the export)"
                  : "Record the gap and who owns it (printed in the export)"
                : "Note — finding, ticket reference, accepted risk (printed in the export)"}
            </label>
            <textarea
              id={`note-${item.id}`}
              value={note}
              onChange={e => onNote(e.target.value)}
              rows={2}
              className={`w-full rounded-lg border px-3 py-2 text-xs text-ink bg-surface resize-y transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent ${
                needsNote && !note.trim() ? "border-amber-500 bg-amber-50/50" : "border-line"
              }`}
              placeholder={
                needsNote
                  ? "An unexplained N/A or Fail is an audit finding waiting to happen."
                  : "Optional"
              }
            />
          </div>
        </div>
      )}
    </li>
  );
}

export function SectionCard({
  section,
  statuses,
  notes,
  onStatus,
  onNote,
  defaultOpen = true,
}: {
  section: ChecklistSection;
  statuses: StatusMap;
  notes: Record<string, string>;
  onStatus: (id: string, status: ItemStatus) => void;
  onNote: (id: string, note: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done = section.items.filter(i => {
    const s = statusOf(statuses, i.id);
    return s === "pass" || s === "na";
  }).length;
  const blockersOpen = section.items.filter(
    i => i.blocking && !["pass", "na"].includes(statusOf(statuses, i.id)),
  ).length;

  return (
    <Panel>
      <PanelHeader
        accent
        title={section.title}
        onClick={() => setOpen(v => !v)}
        expanded={open}
        meta={
          <>
            {blockersOpen > 0 && <Chip tone="danger">{blockersOpen} blocking</Chip>}
            <Chip tone={done === section.items.length ? "brand" : "neutral"}>
              {done}/{section.items.length}
            </Chip>
          </>
        }
      />
      {open && (
        <>
          {section.intro && <PanelIntro>{section.intro}</PanelIntro>}
          <ul className="divide-y divide-line">
            {section.items.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                status={statusOf(statuses, item.id)}
                note={notes[item.id] ?? ""}
                onStatus={s => onStatus(item.id, s)}
                onNote={n => onNote(item.id, n)}
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
