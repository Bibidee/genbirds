"use client";
import { useEffect, useState } from "react";
import { AttemptRecord, getMyProfile, getPlayerAttempts, PlayerProfile, updateUsername } from "@/lib/genlayer";
import { clearWallet, exportPrivateKey, getSessionAddress, isUnlocked } from "@/lib/wallet";
import { fmt, shortAddr } from "@/lib/utils";

const colors: Record<string, string> = {
  PENDING: "bg-slate-200 text-slate-800",
  VALID: "bg-emerald-500 text-white",
  INVALID: "bg-rose-500 text-white",
  SUSPICIOUS: "bg-amber-500 text-white",
  NEEDS_REVIEW: "bg-sky-500 text-white",
};

export default function Profile() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [list, setList] = useState<AttemptRecord[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [exportPw, setExportPw] = useState("");
  const [exported, setExported] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getMyProfile();
      setProfile(p);
      setDraft(p?.username || "");
      const all = await getPlayerAttempts();
      setList(all);
    })();
  }, []);

  const valid = list.filter(a => a.countsForLeaderboard);
  const totalScore = valid.reduce((s, a) => s + a.claimedScore, 0);
  const addr = getSessionAddress();

  if (!isUnlocked()) {
    return (
      <div className="px-4 py-16 mx-auto max-w-md text-center">
        <div className="panel p-6">
          <h1 className="font-display text-2xl font-extrabold">Unlock to view profile</h1>
          <p className="text-sm text-slate-600 mt-2">Open the wallet panel and unlock your account to see attempts and stats.</p>
        </div>
      </div>
    );
  }

  async function saveUsername() {
    if (draft.trim().length < 3) return;
    const p = await updateUsername(draft.trim());
    if (p) setProfile(p);
    setEditing(false);
  }

  async function reveal() {
    const pk = await exportPrivateKey(exportPw);
    setExported(pk);
  }

  return (
    <div className="px-4 py-10 mx-auto max-w-5xl space-y-6">
      <div className="panel p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-bold text-slate-500">Player</div>
          {editing ? (
            <div className="flex gap-2 items-center mt-1">
              <input className="rounded-xl bg-white px-3 py-2 border border-slate-200" value={draft} onChange={e => setDraft(e.target.value)} />
              <button className="btn-primary text-sm py-2 px-3" onClick={saveUsername}>Save</button>
              <button className="btn-ghost text-sm py-2 px-3" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="font-extrabold text-2xl">{profile?.username || "—"}</div>
              <button className="text-xs underline text-slate-500" onClick={() => setEditing(true)}>edit</button>
            </div>
          )}
          <div className="font-mono text-sm text-slate-500 mt-1">{addr}</div>
        </div>
        <div className="flex gap-6">
          <Stat label="Attempts" value={fmt(profile?.totalAttempts ?? list.length)} />
          <Stat label="Valid" value={fmt(profile?.validAttempts ?? valid.length)} />
          <Stat label="Total Score" value={fmt(totalScore)} />
        </div>
      </div>

      <section className="panel p-5 space-y-3">
        <div className="text-xs uppercase font-bold text-slate-500">Backup private key</div>
        <p className="text-sm text-slate-700">If you lose this browser or want to play on another device, save this key. Don’t share it.</p>
        {!exported ? (
          <div className="flex gap-2">
            <input className="flex-1 rounded-xl bg-white px-3 py-2 border border-slate-200" placeholder="Your password" type="password" value={exportPw} onChange={e => setExportPw(e.target.value)} />
            <button className="btn-secondary py-2 px-4" onClick={reveal}>Reveal</button>
          </div>
        ) : (
          <div className="bg-slate-900 text-emerald-300 font-mono text-xs p-3 rounded-xl break-all">{exported}</div>
        )}
        <button
          className="text-xs underline text-rose-600"
          onClick={async () => { if (confirm("This wipes the wallet from this browser. You need the private key to recover.")) { await clearWallet(); location.reload(); } }}>
          Remove wallet from this browser
        </button>
      </section>

      <h2 className="font-display text-2xl font-extrabold">Recent attempts</h2>
      <div className="panel p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/60 text-xs uppercase text-slate-500">
            <tr><th className="p-3">When</th><th className="p-3">Level</th><th className="p-3">Score</th><th className="p-3">Status</th><th className="p-3">Reason</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No attempts yet.</td></tr>}
            {list.slice().reverse().map(a => (
              <tr key={a.id} className="border-t border-white/60">
                <td className="p-3 text-xs text-slate-600">{new Date(a.timestamp).toLocaleString()}</td>
                <td className="p-3">{a.levelId}</td>
                <td className="p-3 font-extrabold tabular-nums">{fmt(a.claimedScore)}</td>
                <td className="p-3"><span className={`badge ${colors[a.status]}`}>{a.status}</span></td>
                <td className="p-3 text-xs text-slate-600">{a.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase font-bold text-slate-500">{label}</div>
      <div className="font-extrabold text-2xl tabular-nums">{value}</div>
    </div>
  );
}
