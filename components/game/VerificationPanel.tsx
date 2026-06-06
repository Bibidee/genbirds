"use client";
import { useEffect, useState } from "react";
import { AttemptRecord, explorerContractUrl } from "@/lib/genlayer";

const colors: Record<string, string> = {
  PENDING: "bg-slate-200 text-slate-800",
  VALID: "bg-emerald-500 text-white",
  INVALID: "bg-rose-500 text-white",
  SUSPICIOUS: "bg-amber-500 text-white",
  NEEDS_REVIEW: "bg-sky-500 text-white",
};

export default function VerificationPanel({ rec }: { rec: AttemptRecord | null }) {
  // Re-read from localStorage every 2s so the explorer link / tx hash that
  // arrives asynchronously from the chain write shows up automatically.
  const [live, setLive] = useState<AttemptRecord | null>(rec);
  useEffect(() => {
    setLive(rec);
    if (!rec) return;
    const t = setInterval(() => {
      try {
        const all = JSON.parse(localStorage.getItem("genbirds.attempts.v2") || "[]") as AttemptRecord[];
        const found = all.find(a => a.id === rec.id);
        if (found) setLive(found);
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [rec?.id]);

  const r = live;
  if (!r) return (
    <div className="panel p-4">
      <div className="text-xs uppercase font-bold text-slate-500">GenLayer Verification</div>
      <div className="text-sm mt-1 text-slate-600">No attempt submitted yet.</div>
    </div>
  );

  return (
    <div className="panel p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase font-bold text-slate-500">GenLayer Verification</div>
        <span className={`badge ${colors[r.status]}`}>{r.status}</span>
      </div>
      <div className="text-sm text-slate-700">{r.reason}</div>

      <div className="flex items-center gap-2 text-xs">
        <span className={`badge ${r.onChain ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700"}`}>
          {r.onChain ? "On chain" : "Submitting…"}
        </span>
        <span className={`badge ${r.countsForLeaderboard ? "bg-sky-500 text-white" : "bg-slate-200"}`}>
          {r.countsForLeaderboard ? "Counted" : "Excluded"}
        </span>
      </div>

      <div className="text-xs text-slate-500 break-all">replay: {r.replayHash}</div>
      <div className="text-xs text-slate-500 break-all">attempt: {r.id}</div>
      {r.txHash && (
        <div className="text-xs text-slate-500 break-all">tx: {r.txHash}</div>
      )}

      <div className="pt-1 flex flex-wrap gap-2">
        <a
          href={r.explorerUrl || explorerContractUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-xs py-1.5 px-3"
        >
          🔗 View on GenLayer Explorer
        </a>
        <a
          href={explorerContractUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs py-1.5 px-3"
        >
          Contract
        </a>
      </div>
    </div>
  );
}
