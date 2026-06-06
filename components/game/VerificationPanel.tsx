import { AttemptRecord } from "@/lib/genlayer";

const colors: Record<string, string> = {
  PENDING: "bg-slate-200 text-slate-800",
  VALID: "bg-emerald-500 text-white",
  INVALID: "bg-rose-500 text-white",
  SUSPICIOUS: "bg-amber-500 text-white",
  NEEDS_REVIEW: "bg-sky-500 text-white",
};

export default function VerificationPanel({ rec }: { rec: AttemptRecord | null }) {
  if (!rec) return (
    <div className="panel p-4">
      <div className="text-xs uppercase font-bold text-slate-500">GenLayer Verification</div>
      <div className="text-sm mt-1 text-slate-600">No attempt submitted yet.</div>
    </div>
  );
  return (
    <div className="panel p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase font-bold text-slate-500">GenLayer Verification</div>
        <span className={`badge ${colors[rec.status]}`}>{rec.status}</span>
      </div>
      <div className="text-sm text-slate-700">{rec.reason}</div>
      <div className="text-xs text-slate-500 break-all">replay: {rec.replayHash}</div>
      <div className="text-xs text-slate-500">attempt: {rec.id}</div>
      <div className="text-xs text-slate-500">leaderboard: {rec.countsForLeaderboard ? "counted" : "excluded"}</div>
    </div>
  );
}
