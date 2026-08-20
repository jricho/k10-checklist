<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo conventions

## Where things live

| Path | Contains |
|---|---|
| `lib/checklist-types.ts` | Types, the seven maturity dimensions, `ocCommandFor()` |
| `lib/commands.ts` | Every shell command, once. Reused across items |
| `lib/stages/{poc,preprod,golive,day2}.ts` | All checklist content — 112 items |
| `lib/checklist-data.ts` | Index, gate logic, dev-time invariant checks |
| `lib/maturity.ts` | Checklist → maturity-model cross-reference |
| `lib/checklist-state.ts` | `useAssessment()` — persistence, import/export |
| `lib/export-pdf.ts` | `PdfWriter` and the PDF export |
| `components/checklist/` | Stage nav, section card, maturity panel, diagnostics |
| `app/page.tsx` | Composition only — no data, no PDF logic |
| `app/legacy/page.tsx` | Frozen copy of the old flat checklist. Do not extend |

`app/page.tsx` is deliberately thin. Checklist content changes belong in
`lib/stages/`, command changes in `lib/commands.ts`, and PDF layout changes in
`lib/export-pdf.ts` — never mixed back into the page.

## Item ids are permanent

Saved assessments and exported JSON are keyed on `item.id`. Renaming an id
orphans every historical answer for that item; reusing a retired id silently
attributes an old answer to a new question. Change labels and prose freely,
**retire ids rather than repurposing them.**

`validateChecklistData()` runs on import in development and fails loudly in the
console on duplicate ids, non-kebab-case ids, missing `why` or `evidence`, and
out-of-range maturity levels. Check the console after editing content.

## Adding an item

```ts
{
  id: "unique-kebab-case-id",     // never reused
  label: "Short statement of the thing to be true",
  why: "The risk it retires, in language a customer can repeat.",
  evidence: "What 'pass' looks like in the output.",
  cmd: C.SOME_SHARED_COMMAND,     // add to lib/commands.ts if reusable
  oc: "...",                      // ONLY if genuinely different from kubectl
  blocking: true,                 // omit unless it gates the stage
  conditional: true,              // omit unless frequently N/A
  signals: [["storage", 3]],      // dimension + level it evidences
  docs: [{ label: "...", url: "..." }],
}
```

## Commands

- **Read-only, always.** Anything mutating (create a snapshot, run a restore) is
  described in prose and performed through the customer's change process. Never
  offer it as copy-paste.
- **Fully-qualify K10 CRDs**: `policies.config.kio.kasten.io`, never `policies`.
  Kyverno, Calico, Gatekeeper and several service meshes all register something
  called `policies`, so the short form silently queries the wrong API group on
  exactly the mature clusters where being wrong matters most.
- **Do not set `oc`** unless the OpenShift path genuinely differs (routes,
  `oc adm top`, SCCs). `ocCommandFor()` derives it by replacing `kubectl`.
- **Prefer discovery to assertion** where a CRD field path might move between
  releases: jq `//` fallbacks, or `grep` over YAML, so a moved field reads as
  "not found" rather than printing a confidently blank column.
- Commands assume `kubectl`/`oc`, `jq` and `helm` on the operator's workstation.

## Maturity tags

Levels are counted upward per dimension and stop at the first level with an
outstanding item — passing three Level 4 items while a Level 2 item fails does
not make an environment Level 4. Consequences when tagging:

- Tag against the playbook's descriptor for that level, not by how hard the item
  feels.
- **Day-2 cadence items should evidence L4/L5 only.** Tagging an operating
  practice at L2 or L3 blocks a pre-go-live customer from a rung they can
  legitimately reach, since "reviewed weekly" cannot be demonstrated at cutover.
- Leaving an item untagged is fine — five platform-hygiene items carry no tag.

## PDF constraints

`lib/export-pdf.ts` uses jsPDF's built-in fonts, which are **WinAnsi-encoded**.
There are no glyphs for `✓`, `○`, `—` or anything outside Latin-1: they render
blank or as mojibake. Use ASCII in anything that reaches the PDF.

All writes go through `PdfWriter`, which reserves vertical space before writing
so a page break can never land inside a block. Do not advance the cursor by hand
or introduce a second bottom-margin constant.

`jspdf` is imported dynamically inside the export handler to keep ~150 KB out of
the first-load bundle. Keep it that way.

## Browser storage

Assessment state persists to `localStorage`; the uploaded architecture diagram
deliberately does **not**. A real cluster PNG is several MB as a data URL against
a ~5 MB quota, and writing it there fails the whole save — taking the checklist
answers with it.

## Before shipping command changes

Several commands read K10 CRD fields whose paths can move between releases.
Validate against a live cluster at the supported version rather than trusting
them; `docs/recommendations.md` §3.3 lists the specific ones and what to check.
