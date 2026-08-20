"use client";

import { useEffect, useState } from "react";
import { CommandBlock } from "../ui/command-block";
import * as C from "../../lib/commands";
import type { OutputKey } from "../../lib/checklist-state";

// Bulk captures that go into the export as evidence.
//
// One change of substance: the third slot is now a Kasten state bundle rather than
// a second cluster-info script. Between them, the policy/profile/action summaries
// and `helm get values` are the four things support asks for first and the four
// things a handover document is useless without — and unlike the per-item
// commands, they are worth capturing verbatim.

const CAPTURES: {
  key: OutputKey;
  title: string;
  blurb: string;
  command: string;
  tone?: "kubectl" | "oc" | "tool";
}[] = [
  {
    key: "primer",
    title: "Pre-flight primer",
    blurb:
      "Checks the prerequisites that cause silent failures later — snapshot classes, CSI capability, RBAC. Resolve every warning rather than noting it.",
    command: "curl -s https://docs.kasten.io/downloads/latest/tools/k10_primer.sh | bash",
    tone: "tool",
  },
  {
    key: "cluster",
    title: "Cluster information",
    blurb:
      "Platform facts in one pass: versions, node topology, storage classes, snapshot capability and metrics availability.",
    command: [
      C.K8S_VERSION,
      C.NODE_SUMMARY,
      C.METRICS_API,
      C.STORAGECLASS_SUMMARY,
      C.VSC_SUMMARY,
      C.SNAPSHOT_STACK,
    ].join(" ; echo ; "),
  },
  {
    key: "policies",
    title: "Kasten configuration & state",
    blurb:
      "The bundle to attach to a support case or a handover: installed version, install-time values, policies, profiles, and anything that did not complete. Commit the values output to version control — a DR-time reinstall that silently differs from the original is its own outage.",
    command: [
      C.K10_VERSION_INSTALLED,
      C.K10_HELM_VALUES,
      C.POLICY_SUMMARY,
      C.POLICIES_WITHOUT_EXPORT,
      C.POLICIES_PAUSED,
      C.PROFILE_SUMMARY,
      C.ACTIONS_NOT_COMPLETE,
      C.K10_POD_HEALTH,
    ].join(" ; echo ; "),
  },
  {
    key: "popeye",
    title: "Cluster sanitizer (Popeye)",
    blurb:
      "Read-only linter over the Kasten namespace: missing probes, absent resource limits, dangling references. Scoped to the namespaced resource types Kasten uses.",
    command:
      "popeye -n kasten-io -s po,deploy,sts,ds,svc,sa,sec,cm,pvc,ing,np,pdb,hpa,cronjobs,jobs,ro,rb -o jurassic",
    tone: "tool",
  },
];

export function DiagnosticsCard({
  outputs,
  onChange,
}: {
  outputs: Record<OutputKey, string>;
  onChange: (key: OutputKey, value: string) => void;
}) {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/k10-version", { signal: controller.signal })
      .then(res => res.json())
      .then((data: { version?: string | null }) => {
        if (data.version) setLatestVersion(data.version);
      })
      .catch(() => {
        /* version badge is decoration — the commands work regardless */
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-base font-semibold text-gray-900">Diagnostic captures</h2>
        {latestVersion && (
          <span
            title="Latest Veeam Kasten release, from charts.kasten.io"
            className="inline-flex items-center gap-1.5 bg-[#219150]/10 text-[#176b3a] text-[10px] font-semibold rounded-full px-2 py-1 shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#219150]" />
            Latest v{latestVersion}
          </span>
        )}
      </div>
      <p className="text-[13px] text-gray-500 mb-5 max-w-3xl leading-relaxed">
        Run these against the target cluster, then paste or load the output. Captures are appended to the exported PDF
        so the evidence pack is self-contained. Everything stays in your browser — this app has no backend and no
        cluster access. Requires <code className="text-[12px] bg-gray-100 rounded px-1">kubectl</code> or{" "}
        <code className="text-[12px] bg-gray-100 rounded px-1">oc</code>,{" "}
        <code className="text-[12px] bg-gray-100 rounded px-1">jq</code> and{" "}
        <code className="text-[12px] bg-gray-100 rounded px-1">helm</code> on your workstation.
      </p>

      <div className="space-y-6">
        {CAPTURES.map((capture, i) => {
          const value = outputs[capture.key] ?? "";
          return (
            <div key={capture.key} className={i > 0 ? "pt-5 border-t border-gray-100" : ""}>
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">{capture.title}</h3>
              <p className="text-[12px] text-gray-500 mb-2 leading-relaxed">{capture.blurb}</p>
              <CommandBlock command={capture.command} tone={capture.tone} />
              <div className="flex items-center justify-between mt-2 mb-1">
                <span className="text-[11px] text-gray-500">
                  Tip: append{" "}
                  <code className="bg-gray-100 rounded px-1">| tee {capture.key}.txt</code> and load the file.
                </span>
                <div className="flex items-center gap-3">
                  <label className="text-[11px] font-medium text-[#219150] hover:underline cursor-pointer">
                    Load from file
                    <input
                      type="file"
                      accept=".txt,.log,.json,.yaml,.yml,text/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => onChange(capture.key, String(reader.result ?? ""));
                        reader.readAsText(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {value && (
                    <button
                      type="button"
                      onClick={() => onChange(capture.key, "")}
                      className="text-[11px] font-medium text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <label htmlFor={`capture-${capture.key}`} className="sr-only">
                {capture.title} output
              </label>
              <textarea
                id={`capture-${capture.key}`}
                value={value}
                onChange={e => onChange(capture.key, e.target.value)}
                spellCheck={false}
                placeholder="Paste the output here"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[11px] font-mono text-gray-800 leading-snug min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[#219150] focus:border-transparent"
              />
              {value && (
                <div className="text-[10px] text-gray-400 mt-1">
                  {value.length.toLocaleString()} characters · {value.split("\n").length.toLocaleString()} lines
                  {value.split("\n").length > 400 && (
                    <span className="text-amber-600">
                      {" "}
                      · only the first 400 lines are printed in the PDF
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
