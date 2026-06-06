"use client";
import Link from "next/link";
import { fmt } from "@/lib/utils";

export default function LevelCompleteModal({
  open, won, score, baseScore, completionBonus, unusedBirdBonus, unusedBirds,
  onRetry, onSubmit, submitted, nextHref,
}: {
  open: boolean; won: boolean;
  score: number; baseScore: number;
  completionBonus: number; unusedBirdBonus: number; unusedBirds: number;
  onRetry: () => void; onSubmit: () => void; submitted: boolean;
  nextHref?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-pop">
      <div className="panel max-w-md w-full p-6 text-center space-y-4">
        <div className="text-5xl">{won ? "🏆" : "💥"}</div>
        <h2 className="text-3xl font-extrabold">{won ? "Level Complete!" : "Out of Birds"}</h2>

        <div className="text-left bg-white/70 rounded-2xl p-4 space-y-1.5">
          <Row label="Base score (enemies + blocks)" value={`+${fmt(baseScore)}`} />
          {won && <Row label="Completion bonus" value={`+${fmt(completionBonus)}`} />}
          {won && <Row label={`Unused birds (${unusedBirds} × 500)`} value={`+${fmt(unusedBirdBonus)}`} />}
          <div className="border-t border-slate-300 my-2" />
          <Row label="Final score" value={fmt(score)} bold />
        </div>

        <div className="text-xs text-slate-500">
          This exact number is what gets submitted to GenLayer.
        </div>

        <div className="flex flex-col gap-2">
          <button className="btn-primary" onClick={onSubmit} disabled={submitted}>
            {submitted ? "Submitted to GenLayer" : "Submit to GenLayer"}
          </button>
          <button className="btn-secondary" onClick={onRetry}>Retry</button>
          {won && nextHref && <Link href={nextHref} className="btn-ghost">Next Level →</Link>}
          <Link href="/play" className="btn-ghost">Back to Levels</Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${bold ? "text-xl font-extrabold" : "text-sm"}`}>
      <span className={bold ? "" : "text-slate-700"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
