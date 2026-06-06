"use client";
import { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { LEVELS, getLevel } from "@/data/levels";
import { BIRDS } from "@/data/birds";
import GameCanvas, { GameState } from "@/components/game/GameCanvas";
import ScorePanel from "@/components/game/ScorePanel";
import VerificationPanel from "@/components/game/VerificationPanel";
import LevelCompleteModal from "@/components/game/LevelCompleteModal";
import { buildReplay } from "@/lib/replay";
import { AttemptRecord, registerLevel, submitAttempt } from "@/lib/genlayer";

export default function PlayLevel() {
  const params = useParams<{ levelId: string }>();
  const level = getLevel(params.levelId);
  if (!level) { notFound(); }
  const birdsDef = useMemo(() => level!.birds.map(t => BIRDS[t]), [level]);
  const [state, setState] = useState<GameState | null>(null);
  const [attempt, setAttempt] = useState<AttemptRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!level) return;
    // registerLevel is now an admin-only contract action. The player flow
    // does NOT touch it — see lib/genlayer.ts adminRegisterLevels.
    // Reset per-level UI state so navigating between levels doesn't leak.
    setState(null);
    setAttempt(null);
    setOpen(false);
  }, [level?.id]);

  const idx = LEVELS.findIndex(l => l.id === level!.id);
  const next = LEVELS[idx + 1];

  async function submit() {
    if (!state || !level) return;
    const replay = buildReplay({
      levelId: level.id,
      levelHash: level.hash,
      birdsUsed: state.birdsUsed,
      launches: state.launches,
      claimedScore: state.score,
      enemiesDestroyed: state.enemiesDestroyed,
      blocksDestroyed: state.blocksDestroyed,
      remainingBirds: state.remainingBirds,
    });
    const rec = await submitAttempt(level, replay);
    setAttempt(rec);
  }

  // Poll localStorage for the on-chain patch on the current attempt so the
  // modal shows the tx hash + "On chain" badge as soon as the background
  // chain write resolves.
  useEffect(() => {
    if (!attempt) return;
    const t = setInterval(() => {
      try {
        const all = JSON.parse(localStorage.getItem("genbirds.attempts.v2") || "[]") as AttemptRecord[];
        const found = all.find(a => a.id === attempt.id);
        if (found && (found.onChain !== attempt.onChain || found.txHash !== attempt.txHash || found.status !== attempt.status)) {
          setAttempt(found);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [attempt?.id]);

  return (
    <div className="px-4 py-6 mx-auto max-w-6xl">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-xs font-bold uppercase text-slate-500">Level {level!.id}</div>
          <h1 className="font-display text-3xl font-extrabold">{level!.name}</h1>
        </div>
        <div className="text-xs text-slate-600">Hash: <span className="font-mono">{level!.hash}</span></div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-3">
          <ScorePanel
            score={state?.score ?? 0}
            birds={birdsDef}
            queue={state?.remainingBirds ?? birdsDef.length}
            current={state?.current ?? birdsDef[0]}
          />
          <GameCanvas
            key={`${level!.id}:${retryKey}`}
            level={level!}
            onState={(s) => setState(s)}
            onEnd={() => setOpen(true)}
          />
        </div>
        <aside className="space-y-3">
          <div className="panel p-4">
            <div className="text-xs uppercase font-bold text-slate-500 mb-2">Current Bird</div>
            {state?.current ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border-2 border-slate-900" style={{ background: state.current.color }} />
                <div>
                  <div className="font-extrabold">{state.current.name}</div>
                  <div className="text-xs text-slate-600 capitalize">Ability: {state.current.ability}</div>
                </div>
              </div>
            ) : <div className="text-sm text-slate-500">—</div>}
            <div className="text-xs text-slate-500 mt-2">Tap while flying to use ability.</div>
          </div>
          <VerificationPanel rec={attempt} />
          <div className="panel p-4 text-xs text-slate-600 space-y-1">
            <div className="font-bold uppercase text-slate-500">Tips</div>
            <div>· Drag the bird back further for more power.</div>
            <div>· Glass shatters fastest, stone resists most.</div>
            <div>· Save a bird for a juicy completion bonus.</div>
          </div>
        </aside>
      </div>

      <LevelCompleteModal
        open={open && !!state}
        won={state?.won ?? false}
        score={state?.score ?? 0}
        baseScore={state?.baseScore ?? 0}
        completionBonus={state?.completionBonus ?? 0}
        unusedBirdBonus={state?.unusedBirdBonus ?? 0}
        unusedBirds={state?.unusedBirds ?? 0}
        submitted={!!attempt}
        attempt={attempt}
        onSubmit={submit}
        onRetry={() => { setOpen(false); setAttempt(null); setRetryKey(k => k + 1); }}
        nextHref={next ? `/play/${next.id}` : undefined}
      />
    </div>
  );
}
