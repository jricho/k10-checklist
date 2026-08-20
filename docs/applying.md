# Applying the changes to jricho/k10-checklist

A step-by-step runbook. Steps 1–7 get it building and running locally; 8–9 get it committed and released; 10–11 are the two things to do before it goes in front of a customer.

Assume `~/Downloads/k10-checklist` is where you saved the folder of new files, and `~/src` is where you keep repos. Adjust both.

---

## 0. Prerequisites

```bash
node --version    # 20 or 22 — the repo's Dockerfile and CI use a current LTS
npm --version
git --version
```

You need npm registry access for `npm install`. No new dependencies are added — `jspdf` is already in `package.json` — but the existing lockfile has to install.

---

## 1. Check what you saved

```bash
find ~/Downloads/k10-checklist -type f | sort
```

Expect exactly 17 files:

```
app/page.tsx
components/checklist/diagnostics-card.tsx
components/checklist/maturity-panel.tsx
components/checklist/section-card.tsx
components/checklist/stage-nav.tsx
components/ui/command-block.tsx
components/ui/status-toggle.tsx
lib/checklist-data.ts
lib/checklist-state.ts
lib/checklist-types.ts
lib/commands.ts
lib/export-pdf.ts
lib/maturity.ts
lib/stages/day2.ts
lib/stages/golive.ts
lib/stages/poc.ts
lib/stages/preprod.ts
```

If `lib/stages/` is missing you have a partial download — the four stage files hold all 112 checklist items and nothing compiles without them.

---

## 2. Clone and branch

```bash
cd ~/src
git clone https://github.com/jricho/k10-checklist
cd k10-checklist
git checkout -b feat/journey-stages
```

Confirm you are starting from a clean tree at `main`:

```bash
git status --short     # should print nothing
git log --oneline -3
```

---

## 3. Copy the files in

The folder mirrors the repo layout, so this is three copies:

```bash
SRC=~/Downloads/k10-checklist

cp -R "$SRC/lib"            ./
cp -R "$SRC/components"     ./
cp    "$SRC/app/page.tsx"   ./app/page.tsx
```

`cp -R lib ./` merges into the existing tree — it does not replace the directory. There is no existing `lib/`, so it is created; `components/` gains two files in `components/ui/` and a new `components/checklist/`.

Verify exactly one file was modified and sixteen added:

```bash
git status --short
```

Expected:

```
 M app/page.tsx
?? components/checklist/
?? components/ui/command-block.tsx
?? components/ui/status-toggle.tsx
?? lib/
```

If `M` appears against anything other than `app/page.tsx`, stop and check what you copied.

Optionally add the write-up to the repo:

```bash
mkdir -p docs && cp ~/Downloads/k10-checklist-recommendations.md docs/recommendations.md
```

---

## 4. Remove the now-unused UI primitives

`card.tsx` and `progress.tsx` are replaced by plain markup; `checkbox.tsx` is replaced by the tri-state `status-toggle.tsx`.

```bash
grep -rn "components/ui/card\|components/ui/checkbox\|components/ui/progress" app components lib
```

That should return nothing. Then:

```bash
git rm components/ui/card.tsx components/ui/checkbox.tsx components/ui/progress.tsx
```

Keeping them does no harm if you would rather not delete them in the same change.

---

## 5. Install and typecheck

```bash
npm install
npx tsc --noEmit
```

I could not run the TypeScript compiler when writing these files, so budget for a small number of nits. The likely candidates, and what to do:

| Symptom | Cause | Fix |
|---|---|---|
| `Type 'string' is not assignable to type 'DimensionId'` in a `lib/stages/*.ts` file | a maturity tag lost its contextual type — usually a typo in the dimension name | check the tag against the seven ids in `lib/checklist-types.ts`: `coverage`, `appconsistency`, `storage`, `central`, `dr`, `observability`, `people` |
| `Type '(string \| number)[]' is not assignable to type 'MaturitySignal'` | the `Stage` annotation is missing from a stage export, so tuples widen to arrays | confirm each file ends up as `export const X_STAGE: Stage = {` |
| `Property 'x' does not exist on type 'JsPdfLike'` | I typed only the jsPDF surface actually used | add the method signature to the `JsPdfLike` interface in `lib/export-pdf.ts` |
| `Cannot find module './stages/poc'` | the `lib/stages/` copy did not land | re-run step 3 |

Then lint:

```bash
npm run lint
```

Most likely lint findings are unused-variable warnings on the exported lookup maps in `lib/checklist-data.ts` (`ITEMS_BY_ID`, `STAGE_OF_ITEM`) — they are there for callers you may add later. Either use them or delete them; they are three lines each.

---

## 6. Run it and smoke-test

```bash
npm run dev
```

Open <http://localhost:3000>. Watch the browser console — `validateChecklistData()` runs on import in development and prints any duplicate ids, malformed ids or out-of-range maturity levels. **A clean console is the first check.**

Then work through this list. It takes about five minutes and covers every mechanism that changed.

**Stage navigation**
1. Four stage cards across the top. Each shows a gate state and an `n/m` count.
2. Click each in turn. The stage header changes, sections change, and the URL does not — state is in the component, persisted to `localStorage`.
3. Stage 1 should read `13 BLOCKING OPEN`; stages 2–4 should read `UPSTREAM BLOCKED`, because stage 1's blockers are outstanding.

**Tri-state and gating**
4. On any item, click **Pass**. The row turns green, the counts increment.
5. Click **Pass** again on the same item. It clears back to pending — a mis-click is recoverable.
6. Click **N/A**. The row greys out, the note box opens with an amber border, and the *applicable* denominator drops by one.
7. Click **Fail**. The row turns red and the note prompt changes wording.
8. Mark all 13 blocking items in stage 1 as Pass or N/A. Stage 1 flips to **GATE CLEAR** and stage 2 changes from `UPSTREAM BLOCKED` to its own blocker count. That is the gating chain working.

**Persistence**
9. Reload the page. Every answer, note and the active stage survive. This is the single biggest behavioural change from the current version.
10. Click **Save** in the header — a `.json` file downloads. Click **Open** and re-select it; state is restored.
11. Open the browser devtools Application tab and confirm one key: `k10-checklist:assessment:v2`.

**Maturity panel**
12. Scroll to *Maturity signals observed*. With stage 1 complete, most dimensions should read `Evidence supports L2`, Observability `L1`.
13. Each dimension lists the named items required for the next level. Those names should match items you have not yet passed.

**Diagnostics and diagram**
14. Click *Show diagnostic captures & architecture diagram*.
15. On any command, click **Copy** (should say "Copied"), then the **1-line / Wrap** toggle.
16. Paste some text into a capture box; the character and line count appears beneath it.
17. Upload any PNG as the architecture diagram; a preview appears.

---

## 7. Check the PDF

Fill in Project, Environment and the RPO/RTO box, then click **Export PDF**. Check:

- **Cover page** — journey position lists all four stages with gate text; RPO/RTO and the three sign-off fields are printed.
- **Status markers** render as `[PASS]`, `[FAIL]`, `[ N/A]`, `[    ]`. If you see blank boxes or garbled characters, something has reintroduced a non-ASCII glyph — jsPDF's built-in fonts are WinAnsi and cannot render `✓`.
- **No clipped text** at the foot of any page. This is what the `PdfWriter` reserve-then-write pattern exists to prevent, so it is worth confirming on a long stage.
- **Maturity signals page** appears after the four stage sections, with per-dimension evidenced levels and outstanding items.
- **Diagram page** present if you uploaded one.
- **Captured output pages** — paste 1,000 lines into a capture box and re-export; it should truncate at 400 with an explicit note, not produce a 60-page appendix.
- **Footers** on every page: project and date left, `Page n of m` right.

---

## 8. Commit

Three commits keep the diff reviewable:

```bash
git add lib
git commit -m "Add stage-gated checklist data, maturity cross-reference and PDF writer

Four journey stages (POC / Pre-Production / Go-Live / Day-2) mapped to the
100-day roadmap phases, 112 items tagged with the maturity dimension and level
they evidence. Gating is driven by named blocking items rather than a completion
percentage. PDF generation extracted from the page component; jsPDF is now
dynamically imported."

git add components
git commit -m "Add tri-state status control, command block and stage components

Pass/Fail/N-A replaces the checkbox so inapplicable items leave the denominator.
Command copy falls back to execCommand outside a secure context instead of
failing silently."

git add app/page.tsx
git add -u    # picks up the three deleted ui primitives
git commit -m "Rewrite page as composition over lib and components

app/page.tsx goes from ~1000 lines to ~340. Adds localStorage persistence and
JSON save/open so an assessment survives a reload and can be version-controlled."
```

Sanity check before pushing:

```bash
git log --oneline -3
git diff --stat main...HEAD
npm run build      # the real test — CI builds the container from this
```

---

## 9. Push and release

```bash
git push -u origin feat/journey-stages
```

Open a PR. Once merged to `main`, the existing `.github/workflows/container.yaml` builds and pushes the multi-arch image. To publish a release with a pinned `install.yaml`:

```bash
git checkout main && git pull
git tag v0.2.0 && git push origin v0.2.0
```

Then test the published artefact the way a customer would:

```bash
kubectl apply -f https://github.com/jricho/k10-checklist/releases/download/v0.2.0/install.yaml
kubectl -n k10-checklist rollout status deploy/k10-checklist
kubectl -n k10-checklist port-forward svc/k10-checklist 8080:80
```

Note for the release notes: saved assessments live in browser `localStorage` under a new key, so anyone with an in-progress checklist on the old version will start fresh. Tell them to export a PDF first.

---

## 10. Validate the K10 field paths against a real cluster

Seven commands read K10 CRD fields whose paths I could not verify against a live install. Each degrades safely — a moved field prints a fallback string rather than a blank — but confirm them once at the version you support. Run these against a cluster with Kasten installed and at least one policy, profile and completed backup:

```bash
# 1. Location Profile immutability period + validation state
kubectl get profiles.config.kio.kasten.io -n kasten-io -o yaml | \
  grep -Ei 'name:|type:|bucket:|protectionPeriod|immutab|validation'
# Looking for: does 'protectionPeriod' exist under locationSpec.objectStore?

# 2. Policy name label on actions
kubectl get backupactions.actions.kio.kasten.io -n kasten-io \
  -o jsonpath='{.items[0].metadata.labels}' | tr ',' '\n'
# Looking for: k10.kasten.io/policyName

# 3. Error message shape on a failed action
kubectl get backupactions.actions.kio.kasten.io -n kasten-io -o json | \
  jq '.items[] | select(.status.state != "Complete") | .status'

# 4. Kasten DR policy and secret names
kubectl get policies.config.kio.kasten.io -n kasten-io -o name
kubectl get secrets -n kasten-io -o name

# 5. Prometheus service name for metric discovery
kubectl get svc -n kasten-io | grep -i prometheus

# 6. Multi-cluster API group
kubectl api-resources --api-group=dist.kio.kasten.io

# 7. Cluster ID — confirm this matches what the K10 UI reports
kubectl get namespace kasten-io -o jsonpath='{.metadata.uid}'; echo
```

Where reality differs, edit the matching constant in `lib/commands.ts`. Every command lives there once, so a fix propagates to every item that uses it.

Also confirm the two documentation URLs in `lib/stages/poc.ts` still resolve:

```bash
curl -sI https://docs.kasten.io/latest/install/requirements.html | head -1
curl -sI https://docs.kasten.io/latest/install/checklist.html | head -1
```

---

## 11. Tune the blocking set

48 of 112 items are marked `blocking: true`. That is my judgement of "would you sign off recovery without this" — yours is better informed by what customers can realistically clear.

To see the current set:

```bash
grep -B6 'blocking: true' lib/stages/*.ts | grep 'id: "'
```

To change one, edit the item in `lib/stages/<stage>.ts` and add or remove the single line:

```ts
blocking: true,
```

Nothing else needs to change — the gate logic in `lib/checklist-data.ts` reads the flag, the stage header lists outstanding blockers by name, and the PDF picks it up.

Per-stage counts if you want to rebalance: POC 13, Pre-Production 14, Go-Live 14, Day-2 7.

---

## Adding or editing a checklist item later

The one rule that matters: **item ids are permanent**. Saved assessments and exported JSON are keyed on them, so renaming an id orphans historical answers, and reusing an old id for a different question silently attributes an old answer to a new claim. Rename labels freely; retire ids rather than repurposing them.

```ts
{
  id: "unique-kebab-case-id",          // never reused
  label: "Short imperative statement",
  why: "The risk this retires, in language a customer can repeat.",
  evidence: "What 'pass' looks like in the output.",
  cmd: C.SOME_SHARED_COMMAND,          // add to lib/commands.ts if reusable
  oc: "...",                           // only if genuinely different from kubectl
  blocking: true,                      // omit unless it gates the stage
  conditional: true,                   // omit unless frequently N/A
  signals: [["storage", 3]],           // dimension + level it evidences
  docs: [{ label: "...", url: "..." }],
},
```

`oc` is derived from `cmd` by replacing `kubectl` with `oc`, so only set it for routes, `oc adm top`, SCCs and similar. `validateChecklistData()` will complain in the dev console if the id collides, the id is not kebab-case, `why` or `evidence` is empty, or a maturity level is outside 1–5.
