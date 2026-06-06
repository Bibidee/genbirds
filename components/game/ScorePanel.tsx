import { fmt } from "@/lib/utils";
import { BirdDef } from "@/data/birds";

export default function ScorePanel({ score, birds, queue, current }: { score: number; birds: BirdDef[]; queue: number; current: BirdDef | null }) {
  return (
    <div className="panel p-4 flex items-center justify-between gap-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Score</div>
        <div className="text-3xl font-extrabold tabular-nums">{fmt(score)}</div>
      </div>
      <div className="flex items-center gap-2">
        {birds.map((b, i) => {
          const used = i < birds.length - queue;
          const isNow = !used && b === current;
          return (
            <div key={i} title={b.name}
              className={`w-9 h-9 rounded-full border-2 ${used ? "opacity-30 grayscale" : ""} ${isNow ? "ring-4 ring-sun-gb" : ""}`}
              style={{ background: b.color, borderColor: "#1a2238" }} />
          );
        })}
      </div>
    </div>
  );
}
