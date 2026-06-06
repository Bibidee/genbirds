"use client";
import { useEffect, useState } from "react";

export type ToastMsg = { id: number; kind: "ok" | "err" | "info"; text: string };
let push: ((m: Omit<ToastMsg, "id">) => void) | null = null;
export function toast(m: Omit<ToastMsg, "id">) { push?.(m); }

export default function ToastHost() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    push = (m) => {
      const id = Date.now() + Math.random();
      setList(l => [...l, { id, ...m }]);
      setTimeout(() => setList(l => l.filter(x => x.id !== id)), 3200);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {list.map(t => (
        <div key={t.id} className={`animate-pop px-4 py-3 rounded-2xl shadow-juicy font-bold text-white ${t.kind === "ok" ? "bg-emerald-500" : t.kind === "err" ? "bg-rose-500" : "bg-slate-800"}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
