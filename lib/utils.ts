export function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }
export function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
export function fmt(n: number) { return n.toLocaleString(); }
export function shortAddr(a?: string) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—"; }
