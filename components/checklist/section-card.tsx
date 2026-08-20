"use client";

import { useState } from "react";
import { CommandBlock } from "../ui/command-block";
import { StatusToggle } from "../ui/status-toggle";
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
 * One checklist item.
 *
 * Three additions over the original row, each earning its space:
 *
 *  - `why`: the risk the item retires, in language a customer can repeat to their
 *    own stakeholders. A checklist that only says what to do gets argued with; one
 *    that says what happens if you skip it gets done.
 *  - `evidence`: what to look for in the output. Running the command was never the
 *    hard part — knowing whether the answer is acceptable is.
 *  - maturity tags: the dimension and level this item feeds, so the link to the
 *    Resilience Playbook is visible at the point of work rather than only in the
 *    export.
 */
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
      className={`px-5 py-4 transition-colors ${
        status === "pass"
          ? "bg-green-50/40"
          : status === "fail"
            ? "bg-red-50/40"
            : status === "na"
              ? "bg-gray-50"
              : ""
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span
              className={`text-sm font-semibold ${
                status === "na" ? "text-gray-400" : "text-gray-900"
              }`}
            >
              {item.label}
            </span>
            {item.blocking && (
              <span
                title="Blocking: this stage cannot be signed off until this item passes or is ruled N/A"
                className="text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded px-1.5 py-0.5 mt-0.5"
              >
                Blocking
              </span>
            )}
            {item.conditional && (
              <span
                title="Frequently N/A — mark N/A with a reason if it does not apply here"
                className="text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 mt-0.5"
              >
                May be N/A
              </span>
            )}
          </div>

          <p className="text-[13px] text-gray-600 mt-1 leading-relaxed">{item.why}</p>

          <p className="text-[12px] text-gray-500 mt-1.5">
            <span className="font-semibold text-gray-600">Evidence of pass: </span>
            {item.evidence}
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-2">
            {item.signals.map(([dim, level]) => (
              <span
                key={`${dim}-${level}`}
                title={`Evidence for Level ${level} of ${DIMENSIONS[dim].name} in the Kasten Maturity Model`}
                className="text-[10px] font-medium text-[#176b3a] bg-[#219150]/10 rounded-full px-2 py-0.5"
              >
                {DIMENSIONS[dim].short} · L{level}
              </span>
            ))}
            {item.docs?.map(d => (
              <a
                key={d.url}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-medium text-[#219150] hover:underline"
              >
                {d.label} ↗
              </a>
            ))}
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-expanded={open}
              className="text-[10px] font-semibold text-gray-500 hover:text-[#219150]"
            >
              {open ? "Hide" : item.cmd ? "Verify & note" : "Add note"}
            </button>
          </div>
        </div>

        <div className="shrink-0 flex items-start gap-2">
          <StatusToggle status={status} onChange={onStatus} itemLabel={item.label} />
        </div>
      </div>

      {(open || needsNote) && (
        <div className="mt-3 pl-0 lg:pl-1 space-y-2">
          {item.cmd && (
            <div className="space-y-2">
              <CommandBlock command={item.cmd} label="kubectl" />
              {oc && oc !== item.cmd && <CommandBlock command={oc} label="oc" tone="oc" />}
            </div>
          )}
          <div>
            <label
              htmlFor={`note-${item.id}`}
              className="block text-[11px] font-medium text-gray-500 mb-1"
            >
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
              className={`w-full border rounded-lg px-3 py-2 text-[12px] text-gray-800 resize-y focus:outline-none focus:ring-2 focus:ring-[#219150] focus:border-transparent ${
                needsNote && !note.trim() ? "border-amber-400 bg-amber-50/40" : "border-gray-300 bg-white"
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
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <h3>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="w-full bg-[#219150] hover:bg-[#1c7d44] transition-colors px-5 py-3 flex items-center justify-between gap-3 text-left"
        >
          <span className="text-sm font-bold text-white uppercase tracking-wide">{section.title}</span>
          <span className="flex items-center gap-2 shrink-0">
            {blockersOpen > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5">
                {blockersOpen} blocking
              </span>
            )}
            <span className="text-[11px] font-semibold text-white bg-white/20 rounded-full px-2 py-0.5 tabular-nums">
              {done}/{section.items.length}
            </span>
            <svg
              className={`h-4 w-4 text-white transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>
      </h3>
      {open && (
        <>
          {section.intro && (
            <p className="px-5 py-3 text-[13px] text-gray-500 bg-gray-50/70 border-b border-gray-100 leading-relaxed">
              {section.intro}
            </p>
          )}
          <ul className="divide-y divide-gray-100">
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
    </section>
  );
}
