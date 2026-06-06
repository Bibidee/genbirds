"use client";
import { useEffect, useState } from "react";
import { LEVELS } from "@/data/levels";
import { getLevelLeaderboard, isContractConfigured, LeaderboardRow } from "@/lib/genlayer";
import { fmt, shortAddr } from "@/lib/utils";

export default function Leaderboard() {
  const [levelId, setLevelId] = useState<string>(LEVELS[0]?.id ?? "");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!levelId) return;
    let stop = false;
    setLoading(true);
    (async () => {
      const r = await getLevelLeaderboard(levelId);
      if (!stop) { setRows(r); setLoading(false); }
    })();
    return () => { stop = true; };
  }, [levelId]);

  return (
    <div className="px-4 py-10 mx-auto max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Leaderboard</h1>
          <p className="text-slate-700">Verified by GenLayer · only VALID attempts count.</p>
        </div>
        <span className={`badge ${isContractConfigured() ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
          {isContractConfigured() ? "Chain mode" : "Local mode"}
        </span>
      </div>

      <div className="panel p-4 mb-4 flex items-center gap-3 flex-wrap">
        <label className="text-xs font-bold uppercase text-slate-500">Level</label>
        <select className="rounded-xl bg-white px-3 py-2 border border-slate-200" value={levelId} onChange={e => setLevelId(e.target.value)}>
          {LEVELS.map(l => <option key={l.id} value={l.id}>{l.id} — {l.name}</option>)}
        </select>
        {loading && <span className="text-xs text-slate-500">Loading…</span>}
      </div>

      <div className="panel p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/60 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Rank</th>
              <th className="p-3">Player</th>
              <th className="p-3">Address</th>
              <th className="p-3">Score</th>
              <th className="p-3">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">No verified scores yet. Be the first.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.attemptId || `${r.player}:${r.rank}`} className="border-t border-white/60">
                <td className="p-3 font-bold">#{r.rank}</td>
                <td className="p-3 font-bold">{r.username || "—"}</td>
                <td className="p-3 font-mono text-xs text-slate-500">{shortAddr(r.player)}</td>
                <td className="p-3 font-extrabold tabular-nums">{fmt(r.score)}</td>
                <td className="p-3 text-xs text-slate-500">{r.timestamp ? new Date(r.timestamp).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
