"use client";
import { useEffect, useState } from "react";
import { createWallet, hasStoredWallet, importPrivateKey, isUnlocked, storedAddress, unlockWallet } from "@/lib/wallet";
import { getMyProfile, registerPlayer, resetClient } from "@/lib/genlayer";
import { shortAddr } from "@/lib/utils";

type Tab = "create" | "unlock" | "import";

export default function WalletGate({ onReady }: { onReady?: (addr: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("create");
  const [hasWallet, setHasWallet] = useState(false);
  const [addr, setAddr] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pk, setPk] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const has = await hasStoredWallet();
      setHasWallet(has);
      const stored = await storedAddress();
      setAddr(stored);
      if (has && !isUnlocked()) {
        setTab("unlock");
        setOpen(true);
      } else if (!has) {
        setTab("create");
        setOpen(true);
      } else {
        setOpen(false);
      }
    })();
  }, []);

  async function doCreate() {
    setError(null);
    if (username.trim().length < 3 || username.trim().length > 20) {
      return setError("Username must be 3–20 characters");
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      return setError("Letters, numbers, _ or - only");
    }
    if (password.length < 6) return setError("Password must be ≥ 6 characters");
    setBusy(true);
    try {
      const w = await createWallet(password);
      resetClient();
      setAddr(w.address);
      await registerPlayer(username.trim());
      onReady?.(w.address);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "Setup failed");
    } finally { setBusy(false); }
  }
  async function doUnlock() {
    setError(null);
    setBusy(true);
    try {
      const r = await unlockWallet(password);
      if (!r) { setError("Wrong password"); return; }
      resetClient();
      setAddr(r.address);
      await getMyProfile();
      onReady?.(r.address);
      setOpen(false);
    } finally { setBusy(false); }
  }
  async function doImport() {
    setError(null);
    if (!/^0x[0-9a-fA-F]{64}$/.test(pk.trim())) return setError("Private key must be 0x + 64 hex chars");
    if (password.length < 6) return setError("Password must be ≥ 6 characters");
    setBusy(true);
    try {
      const r = await importPrivateKey(pk.trim(), password);
      resetClient();
      setAddr(r.address);
      const prof = await getMyProfile();
      if (!prof && username.trim()) await registerPlayer(username.trim());
      onReady?.(r.address);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "Import failed");
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="panel max-w-md w-full p-6 space-y-4 animate-pop">
        <div>
          <div className="text-xs font-bold uppercase text-slate-500">GenBirds Wallet</div>
          <h2 className="text-2xl font-extrabold">{hasWallet ? "Welcome back" : "Set up your account"}</h2>
          <p className="text-sm text-slate-600 mt-1">
            Your wallet lives in this browser. It’s encrypted with your password and stored locally — never sent anywhere.
          </p>
        </div>

        {hasWallet && addr && (
          <div className="text-xs text-slate-600">
            Stored address: <span className="font-mono">{shortAddr(addr)}</span>
          </div>
        )}

        <div className="flex gap-1">
          {(["create", "unlock", "import"] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(null); }}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold ${tab === t ? "bg-bird-red text-white" : "bg-white/70 text-slate-700"}`}>
              {t === "create" ? "Create" : t === "unlock" ? "Unlock" : "Import"}
            </button>
          ))}
        </div>

        {tab === "create" && (
          <div className="space-y-3">
            <Field label="Username" value={username} onChange={setUsername} placeholder="e.g. solar_beak_42" />
            <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="≥ 6 characters" />
            {error && <div className="text-rose-600 text-sm">{error}</div>}
            <button className="btn-primary w-full" onClick={doCreate} disabled={busy}>
              {busy ? "Creating…" : "Create wallet & register"}
            </button>
          </div>
        )}
        {tab === "unlock" && (
          <div className="space-y-3">
            <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="Your password" />
            {error && <div className="text-rose-600 text-sm">{error}</div>}
            <button className="btn-primary w-full" onClick={doUnlock} disabled={busy}>
              {busy ? "Unlocking…" : "Unlock"}
            </button>
          </div>
        )}
        {tab === "import" && (
          <div className="space-y-3">
            <Field label="Private key (0x…)" value={pk} onChange={setPk} placeholder="0x…" />
            <Field label="New password for this device" value={password} onChange={setPassword} type="password" />
            <Field label="Username (only used if no profile is found)" value={username} onChange={setUsername} placeholder="optional" />
            {error && <div className="text-rose-600 text-sm">{error}</div>}
            <button className="btn-primary w-full" onClick={doImport} disabled={busy}>
              {busy ? "Importing…" : "Import & continue"}
            </button>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Lost password = lost account. Export & back up your private key from <span className="font-bold">/profile</span> once unlocked.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-bird-red/40"
      />
    </label>
  );
}
