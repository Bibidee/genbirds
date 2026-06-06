"use client";
import { useMemo, useState } from "react";

type Block = { x: number; y: number; w: number; h: number; kind: "wood" | "stone" | "ice" };
type Enemy = { x: number; y: number; r: number };

export default function Builder() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [mode, setMode] = useState<"wood" | "stone" | "ice" | "enemy">("wood");

  const json = useMemo(() => JSON.stringify({ blocks, enemies }, null, 2), [blocks, enemies]);

  function add(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 1200;
    const y = (e.clientY - rect.top) / rect.height * 640;
    if (mode === "enemy") setEnemies(es => [...es, { x, y, r: 22 }]);
    else setBlocks(bs => [...bs, { x, y, w: 80, h: 16, kind: mode }]);
  }

  return (
    <div className="px-4 py-8 mx-auto max-w-6xl">
      <h1 className="font-display text-4xl font-extrabold mb-1">Level Builder</h1>
      <p className="text-slate-700 mb-4">Sketch a quick layout. Export JSON and drop it into <code className="font-mono text-xs">data/levels.ts</code>.</p>

      <div className="flex gap-2 mb-3">
        {(["wood","stone","ice","enemy"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`btn ${mode === m ? "bg-bird-red text-white" : "bg-white/80 text-slate-800"}`}>{m}</button>
        ))}
        <button className="btn-ghost" onClick={() => { setBlocks([]); setEnemies([]); }}>Clear</button>
      </div>

      <div className="panel p-2">
        <svg viewBox="0 0 1200 640" className="w-full h-auto bg-sky-200 rounded-2xl" onClick={add}>
          <rect x="0" y="600" width="1200" height="40" fill="#76c043" />
          {blocks.map((b, i) => (
            <rect key={i} x={b.x - b.w/2} y={b.y - b.h/2} width={b.w} height={b.h}
              fill={b.kind === "stone" ? "#9aa0a6" : b.kind === "wood" ? "#c9893b" : "#bfeaff"} stroke="#1a2238" strokeWidth="2" />
          ))}
          {enemies.map((e, i) => <circle key={i} cx={e.x} cy={e.y} r={e.r} fill="#5fcf52" stroke="#2e6b1f" strokeWidth="2" />)}
        </svg>
      </div>

      <div className="panel mt-4 p-4">
        <div className="text-xs font-bold uppercase text-slate-500 mb-2">Export</div>
        <pre className="text-xs overflow-auto max-h-72 bg-slate-900 text-white p-3 rounded-xl">{json}</pre>
      </div>
    </div>
  );
}
