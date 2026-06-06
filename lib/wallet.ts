// Embedded EVM wallet for GenBirds.
//
// - First visit: user picks a password → we generate a private key, derive an
//   AES-GCM key from the password (PBKDF2 / SHA-256 / 120k iters), encrypt the
//   key, and store it in IndexedDB.
// - Returning user: enter the password → we decrypt and cache the key for the
//   tab session.
// - New device: paste the private key + a fresh password → same address.
//
// Never touches the network. genlayer.ts uses `getSessionKey()` to sign.

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const DB_NAME = "genbirds";
const STORE = "wallet";
const KEY_BLOB = "encrypted";

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDel(key: string): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(password) as BufferSource, "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

interface EncryptedBlob {
  salt: number[];
  iv: number[];
  ct: number[];
  address: string;        // not secret, kept alongside for UX
  createdAt: number;
}

async function encryptAndStore(privateKey: `0x${string}`, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes = await deriveAesKey(password, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, aes, enc.encode(privateKey) as BufferSource);
  const address = privateKeyToAccount(privateKey).address;
  const blob: EncryptedBlob = {
    salt: Array.from(salt),
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ct)),
    address,
    createdAt: Date.now(),
  };
  await idbPut(KEY_BLOB, blob);
  return address;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let sessionKey: `0x${string}` | null = null;
let sessionAddress: `0x${string}` | null = null;

export async function hasStoredWallet(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try { return !!(await idbGet<EncryptedBlob>(KEY_BLOB)); } catch { return false; }
}
export async function storedAddress(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const b = await idbGet<EncryptedBlob>(KEY_BLOB);
    return b?.address ?? null;
  } catch { return null; }
}

export async function createWallet(password: string): Promise<{ address: string; privateKey: `0x${string}` }> {
  const pk = generatePrivateKey();
  const address = await encryptAndStore(pk, password);
  sessionKey = pk;
  sessionAddress = address as `0x${string}`;
  return { address, privateKey: pk };
}

export async function unlockWallet(password: string): Promise<{ address: string } | null> {
  const blob = await idbGet<EncryptedBlob>(KEY_BLOB);
  if (!blob) return null;
  try {
    const aes = await deriveAesKey(password, new Uint8Array(blob.salt));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(blob.iv) as BufferSource }, aes, new Uint8Array(blob.ct) as BufferSource,
    );
    const pk = new TextDecoder().decode(pt) as `0x${string}`;
    sessionKey = pk;
    sessionAddress = privateKeyToAccount(pk).address;
    return { address: sessionAddress };
  } catch {
    return null;
  }
}

export async function importPrivateKey(pk: string, password: string): Promise<{ address: string }> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error("Invalid private key");
  const address = await encryptAndStore(pk as `0x${string}`, password);
  sessionKey = pk as `0x${string}`;
  sessionAddress = address as `0x${string}`;
  return { address };
}

export async function clearWallet(): Promise<void> {
  sessionKey = null;
  sessionAddress = null;
  try { await idbDel(KEY_BLOB); } catch {}
}

export function getSessionKey(): `0x${string}` | null { return sessionKey; }
export function getSessionAddress(): `0x${string}` | null { return sessionAddress; }
export function isUnlocked(): boolean { return !!sessionKey; }

// One-shot export for "show / copy private key" flows (re-asks password).
export async function exportPrivateKey(password: string): Promise<`0x${string}` | null> {
  const blob = await idbGet<EncryptedBlob>(KEY_BLOB);
  if (!blob) return null;
  try {
    const aes = await deriveAesKey(password, new Uint8Array(blob.salt));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(blob.iv) as BufferSource }, aes, new Uint8Array(blob.ct) as BufferSource,
    );
    return new TextDecoder().decode(pt) as `0x${string}`;
  } catch {
    return null;
  }
}
