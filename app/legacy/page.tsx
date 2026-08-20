"use client";

// ARCHIVED — the original flat "Production Readiness" checklist, kept reachable
// at /legacy so the old and new versions can be compared side by side during
// review. It is not linked from anywhere except the banner on the new page.
//
// This file is frozen. New checklist items belong in lib/stages/*.ts. Once the
// four-stage version has been signed off, delete this route along with
// components/ui/{card,checkbox,progress}.tsx, which nothing else uses.
import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Progress } from "../../components/ui/progress";
import jsPDF from "jspdf";

const sections = [
  {
    title: "Business & Operational Readiness",
    items: [
      {
        label: "Critical applications identified",
        desc: "Ensure all business-critical applications are catalogued and prioritised for protection.",
        cmd: "kubectl get deployments --all-namespaces",
        oc: "oc get deployments --all-namespaces"
      },
      {
        label: "Stateful backup/restore validated",
        desc: "Test backup and restore for stateful workloads to confirm data integrity and avoid data loss.",
        cmd: "kubectl get pvc --all-namespaces",
        oc: "oc get pvc --all-namespaces"
      },
      {
        label: "Stateless backup/restore validated",
        desc: "Validate stateless application recovery to ensure full service restoration is achievable.",
        cmd: "kubectl get deployments --all-namespaces",
        oc: "oc get deployments --all-namespaces"
      },
      {
        label: "Cluster architecture diagram captured",
        desc: "Generate a current-state cluster diagram with philippemerle/KubeDiagrams and attach it to the checklist for sign-off documentation.",
        cmd: "kubectl get all --all-namespaces -o yaml | kube-diagrams -o k10-arch.png -",
        oc: "oc get all --all-namespaces -o yaml | kube-diagrams -o k10-arch.png -"
      },
    ]
  },
  {
    title: "Kubernetes Platform",
    items: [
      {
        label: "Supported Kubernetes version",
        desc: "Confirm the cluster version is within the supported range for Veeam Kasten K10.",
        cmd: "kubectl version --short",
        oc: "oc version"
      },
      {
        label: "Multi-node cluster",
        desc: "Production clusters should comprise multiple nodes to provide high availability.",
        cmd: "kubectl get nodes",
        oc: "oc get nodes"
      },
      {
        label: "All nodes in Ready state",
        desc: "All nodes must be healthy and Ready before deploying K10 in production.",
        cmd: "kubectl get nodes",
        oc: "oc get nodes"
      },
      {
        label: "Sufficient resources available",
        desc: "Verify available CPU and memory headroom to avoid resource exhaustion during backup operations.",
        cmd: "kubectl top nodes",
        oc: "oc adm top nodes"
      }
    ]
  },
  {
    title: "Storage & CSI",
    items: [
      {
        label: "CSI driver installed",
        desc: "A CSI driver is required for dynamic storage provisioning and volume snapshot support.",
        cmd: "kubectl get csidrivers",
        oc: "oc get csidrivers"
      },
      {
        label: "Default StorageClass configured",
        desc: "A default StorageClass ensures PersistentVolumeClaims are bound automatically.",
        cmd: "kubectl get storageclass",
        oc: "oc get storageclass"
      },
      {
        label: "VolumeSnapshotClass available",
        desc: "A VolumeSnapshotClass annotated for Veeam Kasten is required to enable volume snapshots.",
        cmd: "kubectl get volumesnapshotclass.snapshot.storage.k8s.io",
        oc: "oc get volumesnapshotclass.snapshot.storage.k8s.io"
      },
      {
        label: "Snapshot and restore tested",
        desc: "End-to-end snapshot and restore testing validates data protection before production use.",
        cmd: "kubectl get volumesnapshots --all-namespaces",
        oc: "oc get volumesnapshots --all-namespaces"
      }
    ]
  },
  {
    title: "K10 Health",
    items: [
      {
        label: "All K10 pods running",
        desc: "All pods in the kasten-io namespace should be in a Running state for full platform functionality.",
        cmd: "kubectl get pods -n kasten-io",
        oc: "oc get pods -n kasten-io"
      },
      {
        label: "No CrashLoopBackOff pods",
        desc: "Pods in CrashLoopBackOff indicate configuration or resource issues that must be resolved.",
        cmd: "kubectl get pods -A | grep CrashLoopBackOff",
        oc: "oc get pods -A | grep CrashLoopBackOff"
      },
      {
        label: "Dashboard accessible",
        desc: "The K10 dashboard must be reachable for operators to manage and monitor the platform.",
        cmd: "kubectl get svc -n kasten-io",
        oc: "oc get svc -n kasten-io"
      },
      {
        label: "Logs free of errors",
        desc: "Review pod logs for errors or warnings that may indicate underlying issues.",
        cmd: "kubectl logs -n kasten-io -l app=k10",
        oc: "oc logs -n kasten-io -l app=k10"
      }
    ]
  },
  {
    title: "Backup & Disaster Recovery",
    items: [
      {
        label: "Backup policies configured",
        desc: "Backup policies must be defined and active to ensure automated, scheduled data protection.",
        cmd: "kubectl get policies -n kasten-io",
        oc: "oc get policies -n kasten-io"
      },
      {
        label: "Recent backups completed successfully",
        desc: "Verify that recent backup actions completed without errors or warnings.",
        cmd: "kubectl get backupactions -n kasten-io",
        oc: "oc get backupactions -n kasten-io"
      },
      {
        label: "Restore procedures tested",
        desc: "Conduct restore tests to confirm backup integrity and validate recovery time objectives.",
        cmd: "kubectl get restoreactions -n kasten-io",
        oc: "oc get restoreactions -n kasten-io"
      },
    ]
  }
];

export default function ChecklistPage() {
  const [checked, setChecked] = useState(
    sections.map(section => section.items.map(() => false))
  );
  const [customer, setCustomer] = useState("");
  const [environment, setEnvironment] = useState("");
  const [rtoRpoNotes, setRtoRpoNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [stakeholderSignoff, setStakeholderSignoff] = useState(false);
  const [expanded, setExpanded] = useState<boolean[]>(() => sections.map(() => true));
  const [diagram, setDiagram] = useState<string>("");
  const [diagramName, setDiagramName] = useState<string>("");
  const [diagramDims, setDiagramDims] = useState<{ w: number; h: number } | null>(null);
  const [outputs, setOutputs] = useState({ primer: "", k8s: "", oc: "", popeye: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/k10-version")
      .then(res => res.json())
      .then((data: { version?: string | null }) => {
        if (active && data.version) setLatestVersion(data.version);
      })
      .catch(() => {
        /* leave version unknown — the command still works */
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDiagramUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        setDiagram(dataUrl);
        setDiagramName(file.name);
        setDiagramDims({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDiagramClear = () => {
    setDiagram("");
    setDiagramName("");
    setDiagramDims(null);
  };

  type OutputKey = "primer" | "k8s" | "oc" | "popeye";

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(prev => (prev === key ? null : prev)), 1500);
    } catch {
      /* clipboard API unavailable — silently no-op */
    }
  };

  const handleOutputChange = (key: OutputKey, value: string) => {
    setOutputs(prev => ({ ...prev, [key]: value }));
  };

  const handleOutputUpload = (key: OutputKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleOutputChange(key, reader.result as string);
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleOutputClear = (key: OutputKey) => () => handleOutputChange(key, "");

  const handleToggleSection = (si: number) => {
    setExpanded(prev => prev.map((v, i) => (i === si ? !v : v)));
  };
  const handleExpandAll = () => setExpanded(sections.map(() => true));
  const handleCollapseAll = () => setExpanded(sections.map(() => false));
  const allExpanded = expanded.every(Boolean);

  const total = sections.reduce((sum, s) => sum + s.items.length, 0);
  const completed = checked.flat().filter(Boolean).length;
  const percent = Math.round((completed / total) * 100);
  let rag: "red" | "amber" | "green" = "red";
  if (percent >= 80) rag = "green";
  else if (percent >= 50) rag = "amber";

  const ragConfig = {
    green: { label: "GO", bg: "bg-green-600", text: "text-white", border: "border-green-600" },
    amber: { label: "REVIEW", bg: "bg-amber-500", text: "text-white", border: "border-amber-500" },
    red: { label: "NOT READY", bg: "bg-red-600", text: "text-white", border: "border-red-600" },
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const green = [33, 145, 80] as [number, number, number];

    doc.setFillColor(...green);
    doc.rect(0, 0, 210, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Veeam Kasten K10 — Production Readiness Checklist", 10, 14);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Customer: ${customer || "—"}`, 10, 32);
    doc.text(`Environment: ${environment || "—"}`, 10, 39);
    doc.text(`Date: ${date}`, 10, 46);
    doc.text(`Stakeholder sign-off: ${stakeholderSignoff ? "Yes" : "No"}`, 10, 53);
    doc.text(`Progress: ${percent}% (${completed}/${total} items) — ${rag.toUpperCase()}`, 10, 60);

    if (rtoRpoNotes) {
      doc.setFont("helvetica", "bold");
      doc.text("RTO/RPO Notes:", 10, 68);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(rtoRpoNotes, 185);
      doc.text(lines, 10, 74);
    }

    let y = rtoRpoNotes ? 74 + doc.splitTextToSize(rtoRpoNotes, 185).length * 6 + 6 : 70;

    sections.forEach((section, i) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFillColor(...green);
      doc.rect(8, y - 4, 194, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(section.title, 12, y + 1);
      y += 10;

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      section.items.forEach((item, j) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const mark = checked[i][j] ? "✓" : "○";
        doc.setFont("helvetica", "bold");
        doc.text(`${mark}  ${item.label}`, 12, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const descLines = doc.splitTextToSize(item.desc, 180);
        doc.text(descLines, 16, y);
        y += descLines.length * 4.5 + 2;
        doc.setTextColor(80, 80, 80);
        doc.text(`kubectl: ${item.cmd}`, 16, y);
        y += 4;
        doc.text(`oc: ${item.oc}`, 16, y);
        y += 6;
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
      });
      y += 4;
    });

    if (diagram && diagramDims) {
      doc.addPage();
      doc.setFillColor(...green);
      doc.rect(0, 0, 210, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Cluster Architecture Diagram", 10, 14);

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Source: ${diagramName} — generated via philippemerle/KubeDiagrams`, 10, 30);

      const maxW = 190;
      const maxH = 240;
      const scale = Math.min(maxW / diagramDims.w, maxH / diagramDims.h);
      const drawW = diagramDims.w * scale;
      const drawH = diagramDims.h * scale;
      const x = (210 - drawW) / 2;
      const format = diagram.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(diagram, format, x, 36, drawW, drawH);
    }

    const captures: Array<{ title: string; content: string }> = [];
    if (outputs.primer) captures.push({ title: "K10 Primer", content: outputs.primer });
    if (outputs.k8s) captures.push({ title: "Kubernetes Cluster Info", content: outputs.k8s });
    if (outputs.oc) captures.push({ title: "OpenShift Cluster Info", content: outputs.oc });
    if (outputs.popeye) captures.push({ title: "Popeye Sanitizer (kasten-io)", content: outputs.popeye });

    captures.forEach(({ title, content }) => {
      doc.addPage();
      doc.setFillColor(...green);
      doc.rect(0, 0, 210, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Diagnostic Output — ${title}`, 10, 14);

      doc.setTextColor(50, 50, 50);
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(content, 190) as string[];
      const lineHeight = 3.5;
      const topMargin = 30;
      const bottomLimit = 282;
      let y = topMargin;
      lines.forEach(line => {
        if (y > bottomLimit) {
          doc.addPage();
          y = topMargin;
        }
        doc.text(line, 10, y);
        y += lineHeight;
      });
    });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.text(`© ${new Date().getFullYear()} Veeam Software. All rights reserved.`, 10, 292);
      doc.text(`Page ${p} of ${pageCount}`, 185, 292, { align: "right" });
    }

    doc.save(`k10-readiness-${customer ? customer.replace(/\s+/g, "-").toLowerCase() + "-" : ""}${date}.pdf`);
  };

  const handleCheck = (si: number, ii: number) => {
    setChecked(prev => prev.map((arr, s) =>
      s === si ? arr.map((v, i) => (i === ii ? !v : v)) : arr
    ));
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/veeam_logo.svg" alt="Veeam" width={160} height={40} className="h-10 w-auto" unoptimized priority />
            <div className="hidden sm:block h-8 w-px bg-gray-300" />
            <span className="hidden sm:block text-sm font-medium text-gray-500 tracking-wide uppercase">Production Readiness Checklist</span>
          </div>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-[#219150] hover:bg-[#176b3a] text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors duration-150"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
            </svg>
            Export PDF
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Archived-version notice */}
        <div
          role="status"
          className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <span className="text-sm text-amber-900">
            <strong className="font-semibold">Archived version.</strong> This is the original flat checklist, kept for
            comparison. It has no stage gates and no maturity mapping.
          </span>
          <Link
            href="/"
            className="text-sm font-semibold text-[#219150] hover:underline shrink-0"
          >
            Go to the current checklist
          </Link>
        </div>

        {/* Page intro */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Kasten Production Readiness Checklist</h1>
          <p className="text-gray-500 text-base max-w-3xl">
            Use this checklist to validate that your environment meets all requirements for a production-grade Veeam Kasten K10 deployment. Complete each item, capture your RTO/RPO requirements, and export a signed-off PDF for your records.
          </p>
        </div>

        {/* Engagement details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4 uppercase tracking-wide">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#219150] focus:border-transparent bg-white"
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#219150] focus:border-transparent bg-white"
                value={environment}
                onChange={e => setEnvironment(e.target.value)}
                placeholder="e.g. Production, Staging"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#219150] focus:border-transparent bg-white"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">RTO / RPO Requirements</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#219150] focus:border-transparent bg-white min-h-[72px] resize-y"
              placeholder="Document Recovery Time Objective (RTO) and Recovery Point Objective (RPO) targets and any relevant notes..."
              value={rtoRpoNotes}
              onChange={e => setRtoRpoNotes(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="stakeholder-signoff"
              checked={stakeholderSignoff}
              onCheckedChange={() => setStakeholderSignoff(v => !v)}
            />
            <label htmlFor="stakeholder-signoff" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
              Stakeholder sign-off obtained
            </label>
            {stakeholderSignoff && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.707-4.707a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Confirmed
              </span>
            )}
          </div>
        </div>

        {/* Progress summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Overall completion</span>
                <span className="text-sm font-semibold text-gray-900">{completed} / {total} items</span>
              </div>
              <Progress value={percent} />
            </div>
            <div className="flex items-center gap-3 sm:pl-6 sm:border-l sm:border-gray-200">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{percent}%</div>
                <div className="text-xs text-gray-500">Complete</div>
              </div>
              <span className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm ${ragConfig[rag].bg} ${ragConfig[rag].text}`}>
                {ragConfig[rag].label}
              </span>
            </div>
          </div>
        </div>

        {/* Primer & scripts */}
        {(() => {
          const PRIMER_CMD = "curl -s https://docs.kasten.io/downloads/latest/tools/k10_primer.sh | bash";
          const K8S_CMD = "curl -sSL https://raw.githubusercontent.com/jricho/kasten-assessment/refs/heads/main/k8s_cluster_info.sh | bash";
          const OC_CMD = "curl -sSL https://raw.githubusercontent.com/jricho/kasten-assessment/refs/heads/main/oc_cluster_info.sh | bash";
          // Scoped to the kasten-io namespace and limited (via -s) to the
          // namespaced resource types K10 uses. Popeye cannot allow-list only
          // K10-related cluster-scoped resources, so cluster-scoped linters are
          // intentionally omitted here to honour the kasten-io scope.
          const POPEYE_CMD = "popeye -n kasten-io -s po,deploy,sts,ds,svc,sa,sec,cm,pvc,ing,np,pdb,hpa,cronjobs,jobs,ro,rb -o jurassic";

          const renderCommandRow = (
            key: OutputKey,
            cmd: string,
            preTextColor: string,
            badge: React.ReactNode,
          ) => (
            <div className="space-y-2">
              <div className="flex items-stretch gap-2">
                {badge && <div className="shrink-0 self-center">{badge}</div>}
                <div className="relative flex-1 min-w-0">
                  <pre className={`bg-gray-950 ${preTextColor} rounded-lg pl-4 pr-20 py-2.5 text-xs font-mono overflow-x-auto select-all whitespace-pre`}>{cmd}</pre>
                  <button
                    type="button"
                    onClick={() => handleCopy(`cmd-${key}`, cmd)}
                    className="absolute top-1.5 right-1.5 text-[10px] font-semibold uppercase tracking-wide bg-white/10 hover:bg-white/20 text-white rounded px-2 py-1 transition-colors"
                  >
                    {copied === `cmd-${key}` ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-500">
                  Captured output — paste below or upload a file. Included in the exported PDF.
                </span>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-[#219150] hover:underline cursor-pointer">
                    Load from file
                    <input
                      type="file"
                      accept=".txt,.log,.json,.yaml,.yml,text/*"
                      className="hidden"
                      onChange={handleOutputUpload(key)}
                    />
                  </label>
                  {outputs[key] && (
                    <button
                      type="button"
                      onClick={handleOutputClear(key)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={outputs[key]}
                onChange={e => handleOutputChange(key, e.target.value)}
                placeholder={`Paste the script output here (tip: \`${cmd.split("|")[0].trim().replace(/^curl[^ ]* /, "")} | tee ${key}.txt\` then upload).`}
                spellCheck={false}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[11px] font-mono text-gray-800 leading-snug min-h-[88px] resize-y focus:outline-none focus:ring-2 focus:ring-[#219150] focus:border-transparent bg-white"
              />
              {outputs[key] && (
                <div className="text-[10px] text-gray-400">
                  {outputs[key].length.toLocaleString()} chars · {outputs[key].split("\n").length.toLocaleString()} lines captured
                </div>
              )}
            </div>
          );

          return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Diagnostic Tools</h2>
              <p className="text-sm text-gray-500 mb-4">Run these in your shell against the target cluster, then paste or upload the output below — the captured text is appended to the exported PDF for support / handover.</p>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">K10 Primer</span>
                    {latestVersion && (
                      <span
                        title="Latest Veeam Kasten K10 release (from charts.kasten.io)"
                        className="inline-flex items-center gap-1 bg-[#219150]/10 text-[#176b3a] text-[10px] font-semibold rounded-full px-2 py-0.5"
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#219150]" />
                        Latest v{latestVersion}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Collects K10 environment and cluster information for readiness verification. The <code className="font-mono text-[11px] bg-gray-100 rounded px-1 py-0.5">downloads/latest</code> path always fetches the current release.</p>
                  {renderCommandRow("primer", PRIMER_CMD, "text-emerald-300", null)}
                </div>
                <div className="border-t border-gray-100 pt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Cluster Info Scripts</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Gathers detailed cluster information for Kubernetes and OpenShift environments.</p>
                  <div className="space-y-5">
                    {renderCommandRow(
                      "k8s",
                      K8S_CMD,
                      "text-blue-300",
                      <span className="inline-block bg-blue-600 text-white text-xs font-semibold rounded px-2 py-1 min-w-[80px] text-center">Kubernetes</span>,
                    )}
                    {renderCommandRow(
                      "oc",
                      OC_CMD,
                      "text-red-300",
                      <span className="inline-block bg-red-700 text-white text-xs font-semibold rounded px-2 py-1 min-w-[80px] text-center">OpenShift</span>,
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Cluster Sanitizer (Popeye)</span>
                    <a
                      href="https://popeyecli.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-[#219150] hover:underline flex items-center gap-1 shrink-0"
                    >
                      popeyecli.io
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Scans the <code className="font-mono text-[11px] bg-gray-100 rounded px-1 py-0.5">kasten-io</code> namespace for misconfigurations against your current kubeconfig context.
                    Requires Popeye (<code className="font-mono text-[11px] bg-gray-100 rounded px-1 py-0.5">brew install derailed/popeye/popeye</code>). Scoped to K10&apos;s namespaced resources — cluster-scoped resources are not filterable to K10 alone, so they are omitted.
                  </p>
                  {renderCommandRow(
                    "popeye",
                    POPEYE_CMD,
                    "text-purple-300",
                    <span className="inline-block bg-purple-700 text-white text-xs font-semibold rounded px-2 py-1 min-w-[80px] text-center">Popeye</span>,
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Cluster architecture diagram */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-1 gap-4">
            <h2 className="text-base font-semibold text-gray-900">Cluster Architecture Diagram</h2>
            <a
              href="https://github.com/philippemerle/KubeDiagrams"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[#219150] hover:underline flex items-center gap-1 shrink-0"
            >
              philippemerle/KubeDiagrams
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Optional. Generate a diagram of your cluster with KubeDiagrams, then upload the PNG/JPEG here.
            The image will be embedded on its own page in the exported PDF.
          </p>
          {!diagram ? (
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg px-6 py-10 cursor-pointer hover:border-[#219150] hover:bg-gray-50/60 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Click to upload diagram</span>
              <span className="text-xs text-gray-400 mt-1">PNG or JPEG, up to ~5 MB</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleDiagramUpload}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#219150] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700 truncate">{diagramName}</span>
                  {diagramDims && (
                    <span className="text-xs text-gray-400 shrink-0">({diagramDims.w}×{diagramDims.h})</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleDiagramClear}
                  className="text-xs font-medium text-red-600 hover:text-red-800 hover:underline shrink-0 ml-3"
                >
                  Remove
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={diagram} alt="Cluster architecture diagram preview" className="max-h-80 w-auto object-contain" />
              </div>
            </div>
          )}
        </div>

        {/* Install checklist summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">K10 Install Checklist Summary</h2>
            <a
              href="https://docs.kasten.io/latest/install/checklist"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[#219150] hover:underline flex items-center gap-1"
            >
              Full documentation
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-sm font-semibold text-gray-700">Pre-Install</span>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="mt-1 text-gray-400">–</span> Configure an <strong className="text-gray-800">encryption key</strong> for data and metadata protection.</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-gray-400">–</span> Select an <strong className="text-gray-800">authentication mode</strong>: Direct, Basic, Token, or OpenID Connect.</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-gray-400">–</span> Annotate <strong className="text-gray-800">VolumeSnapshotClass</strong> with the required Veeam Kasten label.</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-gray-400">–</span> Determine if <strong className="text-gray-800">FIPS compliant mode</strong> is required (set at install time).</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-sm font-semibold text-gray-700">Post-Install</span>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="mt-1 text-gray-400">–</span> Enable <strong className="text-gray-800">Disaster Recovery</strong> and securely store the cluster ID and passphrase.</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-gray-400">–</span> Safely store the <strong className="text-gray-800">encryption key</strong> — loss means permanent loss of data access.</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-gray-400">–</span> Integrate <strong className="text-gray-800">monitoring</strong> via Prometheus and configure alerting for failures.</li>
                <li className="flex items-start gap-2"><span className="mt-1 text-gray-400">–</span> Configure <strong className="text-gray-800">user roles</strong> and authorisation aligned to your authentication mode.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Checklist sections */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Readiness Sections</h2>
          <button
            type="button"
            onClick={allExpanded ? handleCollapseAll : handleExpandAll}
            className="text-xs font-medium text-[#219150] hover:underline"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <div className="space-y-6">
          {sections.map((section, si) => {
            const sectionDone = checked[si].filter(Boolean).length;
            const sectionTotal = section.items.length;
            const isOpen = expanded[si];
            return (
            <Card key={section.title} className="border border-gray-200 bg-white shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => handleToggleSection(si)}
                aria-expanded={isOpen}
                className="w-full bg-[#219150] hover:bg-[#1c7d44] transition-colors px-6 py-3 flex items-center justify-between gap-4 text-left"
              >
                {/* span, not h2/div: a button may only contain phrasing content,
                    and flow content here made the browser hoist it out of the
                    button — which is what produced the hydration mismatch. This
                    bug predates the rewrite; fixed in place so /legacy loads
                    cleanly for comparison. */}
                <span className="text-sm font-bold text-white uppercase tracking-wider">{section.title}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-white/90 bg-white/15 rounded-full px-2 py-0.5">
                    {sectionDone}/{sectionTotal}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-white transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {isOpen && (
              <CardContent className="p-0">
                <ul className="divide-y divide-gray-100">
                  {section.items.map((item, ii) => (
                    <li key={item.label} className={`px-6 py-4 flex flex-col lg:flex-row lg:items-start lg:gap-6 transition-colors ${checked[si][ii] ? "bg-green-50/50" : "hover:bg-gray-50/60"}`}>
                      <div className="flex items-start gap-3 flex-1 mb-3 lg:mb-0">
                        <Checkbox
                          checked={checked[si][ii]}
                          onCheckedChange={() => handleCheck(si, ii)}
                          className="mt-0.5 shrink-0"
                        />
                        <div>
                          <span className={`block text-sm font-semibold ${checked[si][ii] ? "line-through text-gray-400" : "text-gray-900"}`}>
                            {item.label}
                          </span>
                          <span className="block text-sm text-gray-500 mt-0.5">{item.desc}</span>
                        </div>
                      </div>
                      <div className="lg:w-96 shrink-0 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs font-mono">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Verification Commands</div>
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="inline-block bg-gray-200 text-gray-700 rounded px-1.5 py-0.5 text-[10px] font-sans font-semibold shrink-0">kubectl</span>
                            <span className="text-gray-800 select-all break-all">{item.cmd}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="inline-block bg-red-100 text-red-700 rounded px-1.5 py-0.5 text-[10px] font-sans font-semibold shrink-0">oc</span>
                            <span className="text-gray-800 select-all break-all">{item.oc}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
              )}
            </Card>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-gray-400">&copy; {new Date().getFullYear()} Veeam Software. All rights reserved.</span>
          <a
            href="https://docs.kasten.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#219150] hover:underline"
          >
            docs.kasten.io
          </a>
        </div>
      </footer>
    </div>
  );
}
