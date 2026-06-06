"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSessionAddress, isUnlocked, storedAddress } from "@/lib/wallet";
import { getMyProfile } from "@/lib/genlayer";
import { shortAddr } from "@/lib/utils";

const nav = [
  { href: "/play", label: "Play" },
  { href: "/daily", label: "Daily" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/builder", label: "Builder" },
  { href: "/profile", label: "Profile" },
];

export default function Navbar() {
  const path = usePathname();
  const [addr, setAddr] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  useEffect(() => {
    let stop = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function refresh() {
      attempts++;
      const a = getSessionAddress() ?? (await storedAddress());
      if (stop) return;
      setAddr(a);
      let got = "";
      if (isUnlocked()) {
        const p = await getMyProfile();
        if (stop) return;
        got = p?.username ?? "";
        setUsername(got);
      }
      // Keep polling only until we have an address AND username, or 5 tries.
      if (!stop && (!a || !got) && attempts < 5) {
        timer = setTimeout(refresh, 3000);
      }
    }
    refresh();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, []);
  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <div className="mx-auto max-w-6xl panel px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-display font-extrabold text-[2rem] leading-none">
          <span className="inline-flex w-12 h-12 rounded-full bg-bird-red items-center justify-center shadow-juicy">
            <span className="block w-4 h-4 rounded-full bg-white" />
          </span>
          <span>Gen<span className="text-bird-red">Birds</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {nav.map(n => (
            <Link key={n.href} href={n.href}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition ${path?.startsWith(n.href) ? "bg-sun-gb text-[#3a2a00]" : "hover:bg-white"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {addr && (
            username ? (
              <Link href="/profile" className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-white/60 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold">{username}</span>
                <span className="font-mono text-slate-500">{shortAddr(addr)}</span>
              </Link>
            ) : (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("genbirds:open-wallet-gate"))}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sun-gb border border-yellow-300 text-xs font-bold text-[#3a2a00]"
                title="Pick a username for the leaderboard">
                ⚠ Set username
                <span className="font-mono text-amber-900/70">{shortAddr(addr)}</span>
              </button>
            )
          )}
          <Link href="/play" className="btn-primary text-sm py-2 px-4">Play Now</Link>
        </div>
      </div>
    </header>
  );
}
