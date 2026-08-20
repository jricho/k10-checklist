"use client";

import { useState } from "react";

// Copy-to-clipboard with a working fallback.
//
// The original swallowed clipboard failures silently. `navigator.clipboard` is
// undefined outside a secure context, and an Ingress served over plain HTTP —
// exactly how a self-hosted internal tool tends to get exposed — is not one. The
// button appeared to do nothing, which reads as a broken app rather than as a
// browser restriction. This falls back to the legacy path and, if that also
// fails, says so and selects the text so the user can copy it manually.

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CommandBlock({
  command,
  label,
  tone = "kubectl",
}: {
  command: string;
  label?: string;
  tone?: "kubectl" | "oc" | "tool";
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [wrap, setWrap] = useState(true);

  const badge =
    tone === "oc"
      ? "bg-red-100 text-red-700"
      : tone === "tool"
        ? "bg-purple-100 text-purple-700"
        : "bg-surface-sunken text-ink-muted border border-line";

  return (
    <div className="group relative">
      {label && (
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-sans font-semibold mb-1 ${badge}`}
        >
          {label}
        </span>
      )}
      <div className="relative">
        <pre
          className={`bg-slate-950 text-brand-200 rounded-lg pl-3 pr-24 py-2 text-[11px] font-mono leading-relaxed select-all ${
            wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto whitespace-pre"
          }`}
        >
          {command}
        </pre>
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
          {/* Long jq pipelines are unreadable wrapped and unreadable scrolled —
              which is better depends on whether you are reading or copying. */}
          <button
            type="button"
            onClick={() => setWrap(v => !v)}
            title={wrap ? "Show on one line" : "Wrap long lines"}
            className="text-[10px] font-semibold uppercase tracking-wide bg-white/10 hover:bg-white/20 text-white rounded px-1.5 py-1"
          >
            {wrap ? "1-line" : "Wrap"}
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(command);
              setState(ok ? "copied" : "failed");
              setTimeout(() => setState("idle"), 2500);
            }}
            className="text-[10px] font-semibold uppercase tracking-wide bg-white/10 hover:bg-white/20 text-white rounded px-2 py-1"
          >
            {state === "copied" ? "Copied" : state === "failed" ? "Select & copy" : "Copy"}
          </button>
        </div>
      </div>
      {state === "failed" && (
        <p className="text-[10px] text-amber-600 mt-1">
          Clipboard access is blocked — this usually means the page is not served over HTTPS. The command text
          is selectable above.
        </p>
      )}
    </div>
  );
}
