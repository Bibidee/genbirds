import { BirdDef } from "@/data/birds";
export default function BirdCard({ bird }: { bird: BirdDef }) {
  return (
    <div className="panel p-4 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full border-2 border-slate-900 shadow-juicy" style={{ background: bird.color }} />
      <div>
        <div className="font-extrabold">{bird.name}</div>
        <div className="text-xs text-slate-600">{bird.description}</div>
        <div className="mt-1 flex gap-1">
          <span className="badge bg-slate-100">DMG {bird.damage}</span>
          <span className="badge bg-slate-100">WT {bird.weight}</span>
          <span className="badge bg-sun-gb/60">{bird.ability}</span>
        </div>
      </div>
    </div>
  );
}
