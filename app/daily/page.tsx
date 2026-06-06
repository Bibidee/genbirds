import Link from "next/link";
import { LEVELS } from "@/data/levels";

export default function Daily() {
  const today = new Date();
  const day = Math.floor(today.getTime() / 86400000);
  const lvl = LEVELS[day % LEVELS.length];
  return (
    <div className="px-4 py-10 mx-auto max-w-3xl">
      <h1 className="font-display text-4xl font-extrabold mb-2">Daily Challenge</h1>
      <p className="text-slate-700 mb-6">A new featured level every day. Same level for everyone.</p>
      <div className="panel p-6 space-y-4">
        <div className="text-xs font-bold uppercase text-slate-500">Today’s level</div>
        <div className="flex items-baseline justify-between">
          <div className="font-extrabold text-3xl">{lvl.name}</div>
          <span className={`badge ${lvl.difficulty === "easy" ? "bg-emerald-200" : lvl.difficulty === "medium" ? "bg-amber-200" : "bg-rose-200"}`}>{lvl.difficulty}</span>
        </div>
        <div className="text-sm text-slate-600">{lvl.birds.length} birds · {lvl.enemies.length} enemies · max score {lvl.maxScore.toLocaleString()}</div>
        <Link href={`/play/${lvl.id}`} className="btn-primary inline-flex">▶ Play Today</Link>
      </div>
    </div>
  );
}
