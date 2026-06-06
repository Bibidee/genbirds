import Link from "next/link";
import { LEVELS } from "@/data/levels";

export default function PlayIndex() {
  return (
    <div className="px-4 py-10 mx-auto max-w-6xl">
      <h1 className="font-display text-4xl font-extrabold mb-2">Choose a Level</h1>
      <p className="text-slate-700 mb-8">Polish your shots. Climb the verified leaderboard.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {LEVELS.map(lvl => (
          <Link key={lvl.id} href={`/play/${lvl.id}`} className="panel p-5 hover:-translate-y-1 transition group">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase text-slate-500">Level {lvl.id}</div>
              <span className={`badge ${lvl.difficulty === "easy" ? "bg-emerald-200" : lvl.difficulty === "medium" ? "bg-amber-200" : "bg-rose-200"}`}>{lvl.difficulty}</span>
            </div>
            <div className="font-extrabold text-2xl mt-1 group-hover:text-bird-red transition">{lvl.name}</div>
            <div className="text-sm text-slate-600 mt-2">{lvl.birds.length} birds · {lvl.enemies.length} enemies · {lvl.blocks.length} blocks</div>
            <div className="mt-3 text-xs text-slate-500">Max score: <span className="font-bold">{lvl.maxScore.toLocaleString()}</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
