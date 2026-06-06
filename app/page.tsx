import Link from "next/link";
import { BIRD_LIST } from "@/data/birds";
import { LEVELS } from "@/data/levels";

export default function Home() {
  return (
    <div className="px-4 py-10">
      <section className="mx-auto max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6 animate-pop">
          <span className="badge bg-bird-yellow text-[#3a2a00]">Physics arcade · on GenLayer</span>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-tight">
            Launch birds. <span className="text-bird-red">Smash structures.</span>
            <br/>Verified on-chain.
          </h1>
          <p className="text-lg text-slate-700 max-w-prose">
            Drag, aim, and release original arcade birds across handcrafted physics puzzles.
            Every score is replay-hashed and judged by <strong>GenLayer</strong> validators —
            so the leaderboard is one you can actually trust.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/play" className="btn-primary text-lg">▶ Play Now</Link>
            <Link href="/leaderboard" className="btn-secondary">🏆 Leaderboard</Link>
            <Link href="/daily" className="btn-ghost">⭐ Daily Challenge</Link>
          </div>
          <div className="flex gap-2 pt-2">
            {BIRD_LIST.slice(0, 7).map(b => (
              <div key={b.type} title={b.name}
                className="w-10 h-10 rounded-full border-2 border-slate-900 shadow-juicy animate-floaty"
                style={{ background: b.color, animationDelay: `${Math.random()}s` }} />
            ))}
          </div>
        </div>

        <div className="panel p-6 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-sun-gb/70 blur-2xl" />
          <h2 className="font-extrabold text-2xl mb-4">Meet the Flock</h2>
          <div className="grid grid-cols-2 gap-3">
            {BIRD_LIST.map(b => (
              <div key={b.type} className="flex items-center gap-3 bg-white/80 rounded-2xl p-3 border border-white/60">
                <div className="w-10 h-10 rounded-full border-2 border-slate-900" style={{ background: b.color }} />
                <div>
                  <div className="font-bold text-sm">{b.name}</div>
                  <div className="text-xs text-slate-600 capitalize">{b.ability}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl mt-16">
        <h2 className="font-display text-3xl font-extrabold mb-6">Featured Levels</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LEVELS.slice(0, 6).map(lvl => (
            <Link key={lvl.id} href={`/play/${lvl.id}`} className="panel p-5 hover:-translate-y-1 transition">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase text-slate-500">{lvl.id}</div>
                <span className={`badge ${lvl.difficulty === "easy" ? "bg-emerald-200" : lvl.difficulty === "medium" ? "bg-amber-200" : "bg-rose-200"}`}>{lvl.difficulty}</span>
              </div>
              <div className="font-extrabold text-xl mt-1">{lvl.name}</div>
              <div className="text-sm text-slate-600 mt-1">{lvl.birds.length} birds · {lvl.enemies.length} enemies</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl mt-16 grid md:grid-cols-3 gap-4">
        <div className="panel p-5">
          <div className="text-3xl">🎮</div>
          <h3 className="font-extrabold text-lg mt-1">Real Physics</h3>
          <p className="text-sm text-slate-700">Matter.js simulation, juicy collisions, 7 distinct bird abilities.</p>
        </div>
        <div className="panel p-5">
          <div className="text-3xl">🔗</div>
          <h3 className="font-extrabold text-lg mt-1">GenLayer Verified</h3>
          <p className="text-sm text-slate-700">Compact replay hashes are judged by intelligent validators.</p>
        </div>
        <div className="panel p-5">
          <div className="text-3xl">🏆</div>
          <h3 className="font-extrabold text-lg mt-1">Trustworthy Boards</h3>
          <p className="text-sm text-slate-700">Only VALID attempts count — suspicious scores are flagged.</p>
        </div>
      </section>
    </div>
  );
}
