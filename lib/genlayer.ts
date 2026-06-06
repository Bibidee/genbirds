// GenLayer client wrapper for the GenBirds v2 contract
// (0xcde8C50A9Ed6Ebf2027219B141E74227379383d7).
//
// Calls are signed with the embedded wallet from lib/wallet.ts.
// All real chain calls are wrapped in try/catch — on failure or if genlayer-js
// can't be initialised, we transparently mirror state to localStorage so the
// UI never breaks. The local mirror uses the same validation rules as the
// contract.

import type { ReplayMeta } from "./replay";
import type { Level } from "@/data/levels";
import { getSessionAddress, getSessionKey } from "./wallet";
import { genlayerStudionet, GENLAYER_RPC, GENLAYER_CHAIN_ID } from "./chains/genlayerStudionet";

const CONTRACT = (process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS || "").trim();
const RPC = (process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "").trim();

export type Verdict = "PENDING" | "VALID" | "INVALID" | "SUSPICIOUS" | "NEEDS_REVIEW";

export interface PlayerProfile {
  player: string;
  username: string;
  createdAt: number;
  updatedAt: number;
  totalAttempts: number;
  validAttempts: number;
  suspiciousAttempts: number;
  invalidAttempts: number;
}

export interface AttemptRecord {
  id: string;
  player: string;
  username?: string;
  levelId: string;
  claimedScore: number;
  replayHash: string;
  status: Verdict;
  reason: string;
  timestamp: number;
  countsForLeaderboard: boolean;
  onChain?: boolean;
  txHash?: string;
  explorerUrl?: string;
}

// GenLayer Studio explorer. Override via env if it ever moves.
const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_BASE?.trim() ||
  "https://explorer-studio.genlayer.com";

export function explorerTxUrl(txHash?: string): string {
  if (!txHash) return `${EXPLORER_BASE}/contracts/${CONTRACT}`;
  return `${EXPLORER_BASE}/tx/${txHash}`;
}
export function explorerContractUrl(): string {
  return `${EXPLORER_BASE}/contracts/${CONTRACT}`;
}

export interface LeaderboardRow {
  rank: number;
  player: string;
  username: string;
  score: number;
  attemptId: string;
  timestamp: number;
}

const LS_ATT = "genbirds.attempts.v2";
const LS_PROFILE = "genbirds.profile.v2";
const LS_REG = "genbirds.registered.v2";

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write<T>(k: string, v: T) {
  if (typeof window !== "undefined") localStorage.setItem(k, JSON.stringify(v));
}

export function isContractConfigured(): boolean {
  return Boolean(
    CONTRACT &&
    CONTRACT !== "0x0000000000000000000000000000000000000000" &&
    CONTRACT.length >= 40 &&
    RPC,
  );
}
export function getContractInfo() {
  return { address: CONTRACT, rpc: RPC, configured: isContractConfigured() };
}

// ---------------------------------------------------------------------------
// genlayer-js client (lazy + cached, rebuilt when wallet session changes)
// ---------------------------------------------------------------------------

type AnyClient = {
  readContract: (args: any) => Promise<any>;
  writeContract: (args: any) => Promise<any>;
};

let clientPromise: Promise<AnyClient | null> | null = null;
let clientForAddress: string | null = null;

export function resetClient() { clientPromise = null; clientForAddress = null; }

function safeCall<T>(fn: () => T): T | null {
  try { return fn(); } catch { return null; }
}

async function getClient(): Promise<AnyClient | null> {
  if (!isContractConfigured() || typeof window === "undefined") return null;
  const addr = getSessionAddress();
  if (clientPromise && clientForAddress === addr) return clientPromise;
  clientForAddress = addr;

  clientPromise = (async () => {
    try {
      // The embedded wallet IS the signer. Without a session key, refuse to
      // build a client so we never produce an unsigned write by accident.
      const pk = getSessionKey();
      if (!pk) {
        console.warn("[genlayer] no session key — wallet must be unlocked before chain calls");
        return null;
      }

      // genlayer-js 1.1.7 API:
      //   import { createClient, createAccount } from "genlayer-js"
      //   import { studionet } from "genlayer-js/chains"
      //   createClient({ chain, endpoint, account })
      // We pin the chain to the SDK's own studionet export and override the
      // endpoint to our same-origin proxy so the browser never hits an
      // external RPC directly.
      // @ts-ignore optional runtime dep
      const gl: any = await import("genlayer-js").catch(() => null);
      // @ts-ignore optional runtime dep
      const glChains: any = await import("genlayer-js/chains").catch(() => null);

      if (!gl || !gl.createClient) {
        console.warn("[genlayer] genlayer-js missing or wrong version (need 1.1.7+ with createClient)");
        return null;
      }

      const account = gl.createAccount(pk);
      const chain = glChains?.studionet ?? gl.chains?.studionet ?? genlayerStudionet;

      const client = gl.createClient({
        chain,
        endpoint: GENLAYER_RPC,
        account,
      });

      console.log("[genlayer] signer", account.address);
      console.log("[genlayer] chain id", chain?.id);
      console.log("[genlayer] chain name", chain?.name);
      console.log("[genlayer] rpc", GENLAYER_RPC);

      if (!chain?.id) throw new Error("GenLayer client has no chain configured");

      // Adapter: our internal AnyClient takes { address, functionName, args }
      // and the genlayer-js writeContract requires `value: bigint`. We tack
      // value: 0n on for every write because GenBirds calls are non-payable.
      const adapter: AnyClient = {
        async readContract({ address, functionName, args }: any) {
          return client.readContract({ address, functionName, args, jsonSafeReturn: true });
        },
        async writeContract({ address, functionName, args }: any) {
          return client.writeContract({ address, functionName, args, value: 0n });
        },
      };
      console.info("[genlayer] genlayer-js client ready, signer:", account.address);
      return adapter;
    } catch (e) {
      console.warn("[genlayer] client init failed", e);
      return null;
    }
  })();

  return clientPromise;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[genlayer] ${label} timed out after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

async function chainRead(functionName: string, args: any[]): Promise<any | null> {
  try {
    const c = await withTimeout(getClient(), 3000, "client init");
    if (!c?.readContract) return null;
    return await withTimeout(c.readContract({ address: CONTRACT, functionName, args }), 5000, `read ${functionName}`);
  } catch (e) {
    console.warn("[genlayer] read failed", functionName, e);
    return null;
  }
}
async function chainWrite(functionName: string, args: any[]): Promise<any | null> {
  try {
    // Guard: never write without an unlocked embedded wallet.
    if (!getSessionKey()) {
      console.warn(`[genlayer] write ${functionName} skipped — wallet locked`);
      return null;
    }

    // Hard guards on the payload — fail loud rather than send garbage.
    if (!functionName) throw new Error("writeContract functionName missing");
    if (!CONTRACT) throw new Error("contract address missing");
    if (!Array.isArray(args)) throw new Error("writeContract args must be an array");

    const signer = getSessionAddress();
    console.log("[genlayer] write payload", {
      functionName,
      args,
      argsIsArray: Array.isArray(args),
      contractAddress: CONTRACT,
      signer,
      chainId: GENLAYER_CHAIN_ID,
      rpcUrl: GENLAYER_RPC,
    });

    const c = await withTimeout(getClient(), 3000, "client init");
    if (!c?.writeContract) return null;
    const result = await withTimeout(
      c.writeContract({ address: CONTRACT, functionName, args }),
      10000, `write ${functionName}`,
    );
    console.info(`[genlayer] write ${functionName} signed by ${signer} →`, result);
    return result;
  } catch (e) {
    console.warn("[genlayer] write failed", functionName, e);
    return null;
  }
}

// Fire-and-forget background write. Never awaited from the UI path.
function bgWrite(functionName: string, args: any[]) {
  chainWrite(functionName, args).catch(() => {});
}

function parseProfileJson(raw: string | null | undefined): PlayerProfile | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const o = JSON.parse(raw);
    if (!o || !o.player) return null;
    return {
      player: o.player,
      username: o.username || "",
      createdAt: Number(o.created_at) || 0,
      updatedAt: Number(o.updated_at) || 0,
      totalAttempts: Number(o.total_attempts) || 0,
      validAttempts: Number(o.valid_attempts) || 0,
      suspiciousAttempts: Number(o.suspicious_attempts) || 0,
      invalidAttempts: Number(o.invalid_attempts) || 0,
    };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Player profile / username
// ---------------------------------------------------------------------------

export async function registerPlayer(username: string): Promise<PlayerProfile> {
  const addr = getSessionAddress();
  if (!addr) throw new Error("wallet not unlocked");
  const profile: PlayerProfile = {
    player: addr, username,
    createdAt: Date.now(), updatedAt: Date.now(),
    totalAttempts: 0, validAttempts: 0, suspiciousAttempts: 0, invalidAttempts: 0,
  };
  write(LS_PROFILE, profile);
  bgWrite("register_player", [username]);   // fire & forget
  return profile;
}

export async function updateUsername(newUsername: string): Promise<PlayerProfile | null> {
  const addr = getSessionAddress();
  if (!addr) return null;
  const cur = read<PlayerProfile | null>(LS_PROFILE, null);
  const updated: PlayerProfile = { ...(cur ?? {
    player: addr, username: newUsername,
    createdAt: Date.now(), updatedAt: Date.now(),
    totalAttempts: 0, validAttempts: 0, suspiciousAttempts: 0, invalidAttempts: 0,
  }), username: newUsername, updatedAt: Date.now() };
  write(LS_PROFILE, updated);
  bgWrite("update_username", [newUsername]); // fire & forget
  return updated;
}

export async function getMyProfile(): Promise<PlayerProfile | null> {
  const addr = getSessionAddress();
  if (!addr) return null;
  // Return the cached profile immediately, refresh from chain in the
  // background. This keeps every navigation snappy even when RPC is slow.
  const cached = read<PlayerProfile | null>(LS_PROFILE, null);
  chainRead("get_my_profile", []).then(raw => {
    const p = parseProfileJson(typeof raw === "string" ? raw : null);
    if (p) write(LS_PROFILE, p);
  }).catch(() => {});
  return cached;
}

export async function getPlayerProfile(address: string): Promise<PlayerProfile | null> {
  const raw = await chainRead("get_player_profile", [address]);
  return parseProfileJson(typeof raw === "string" ? raw : null);
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

// Level registration is an OWNER/ADMIN action, not part of normal player flow.
// We never trigger it from the player wallet during gameplay — the contract
// owner does it once during deploy via scripts/registerLevels.ts.
export async function registerLevel(_level: Level): Promise<{ ok: boolean; via: "local" }> {
  // Intentionally a no-op for player flow. Kept as an export so existing
  // callers continue to type-check; future admin code can call
  // adminRegisterLevels() below from a trusted context.
  return { ok: true, via: "local" };
}

// Owner/admin-only: explicit, opt-in helper that the deployed app does NOT
// invoke automatically. Run from a script or an admin page when wiring up
// new levels. Kept here so the contract surface is documented in one place.
export async function adminRegisterLevels(levels: Level[]): Promise<void> {
  for (const lvl of levels) {
    await chainWrite("register_level", [
      lvl.id, lvl.hash, lvl.maxScore, lvl.birds.length, lvl.enemies.length, lvl.blocks.length,
    ]);
  }
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

function judge(level: Level | undefined, replay: ReplayMeta): { verdict: Verdict; reason: string } {
  if (!level) return { verdict: "NEEDS_REVIEW", reason: "Unknown level" };
  if (replay.levelHash !== level.hash) return { verdict: "INVALID", reason: "Level hash mismatch" };
  if (!replay.replayHash) return { verdict: "INVALID", reason: "Missing replay hash" };
  if (!replay.physicsSummaryHash) return { verdict: "INVALID", reason: "Missing physics summary" };
  if (replay.birdsUsed > level.birds.length) return { verdict: "INVALID", reason: "Birds used exceeds allowed" };
  if (replay.birdsUsed + replay.remainingBirds > level.birds.length) return { verdict: "INVALID", reason: "Bird accounting mismatch" };
  if (replay.claimedScore < 0) return { verdict: "INVALID", reason: "Negative score" };
  if (replay.enemiesDestroyed > level.enemies.length) return { verdict: "SUSPICIOUS", reason: "Enemy count mismatch" };
  if (replay.blocksDestroyed > level.blocks.length) return { verdict: "SUSPICIOUS", reason: "Block count mismatch" };
  if (replay.claimedScore > Math.floor(level.maxScore * 1.05)) return { verdict: "SUSPICIOUS", reason: "Score exceeds plausible maximum" };
  if (replay.enemiesDestroyed === level.enemies.length) return { verdict: "VALID", reason: "Completed level within bounds" };
  if (replay.claimedScore > 0) return { verdict: "NEEDS_REVIEW", reason: "Partial completion requires review" };
  return { verdict: "VALID", reason: "Within bounds" };
}

export async function submitAttempt(level: Level, replay: ReplayMeta): Promise<AttemptRecord> {
  const player = getSessionAddress();
  if (!player) throw new Error("wallet not unlocked");
  const profile = read<PlayerProfile | null>(LS_PROFILE, null);
  const verdict = judge(level, replay);
  const attemptId = replay.replayHash + "_" + Date.now().toString(36);
  const rec: AttemptRecord = {
    id: attemptId, player, username: profile?.username,
    levelId: replay.levelId,
    claimedScore: replay.claimedScore,
    replayHash: replay.replayHash,
    status: verdict.verdict,
    reason: verdict.reason,
    timestamp: Date.now(),
    countsForLeaderboard: verdict.verdict === "VALID",
    onChain: false,
  };

  // Persist local mirror immediately so the UI flips state right away.
  const all = read<AttemptRecord[]>(LS_ATT, []);
  all.push(rec);
  write(LS_ATT, all);

  // Fire chain submission in the background. When it resolves we patch the
  // mirrored record so future reads reflect the on-chain verdict + tx hash.
  if (isContractConfigured()) {
    chainWrite("submit_attempt", [
      attemptId, replay.levelId, replay.levelHash,
      replay.birdsUsed, replay.claimedScore,
      replay.enemiesDestroyed, replay.blocksDestroyed, replay.remainingBirds,
      replay.replayHash, replay.physicsSummaryHash,
    ]).then(res => {
      if (res === null) return;
      const list = read<AttemptRecord[]>(LS_ATT, []);
      const i = list.findIndex(a => a.id === attemptId);
      if (i < 0) return;
      list[i].onChain = true;
      list[i].reason += " · submitted on-chain";
      // Extract a tx hash if the SDK returned one. Different genlayer-js
      // versions return either a string, { hash }, or { transactionHash }.
      let hash: string | undefined;
      if (typeof res === "string" && /^0x[0-9a-fA-F]{32,}$/.test(res)) hash = res;
      else if (typeof res === "object" && res !== null) {
        const o = res as any;
        hash = o.hash || o.transactionHash || o.txHash;
      }
      if (hash) {
        list[i].txHash = hash;
        list[i].explorerUrl = explorerTxUrl(hash);
      } else {
        // No hash returned — at least link to the contract page so the user
        // can navigate to recent transactions.
        list[i].explorerUrl = explorerContractUrl();
      }
      // Also extract verdict string from common return shapes.
      const verdictStr =
        typeof res === "string" ? res :
        (res as any)?.result || (res as any)?.verdict || "";
      if (typeof verdictStr === "string" && /^(VALID|INVALID|SUSPICIOUS|PENDING|NEEDS_REVIEW)$/.test(verdictStr)) {
        list[i].status = verdictStr as Verdict;
        list[i].countsForLeaderboard = verdictStr === "VALID";
      }
      write(LS_ATT, list);
    }).catch(() => {});
  }

  return rec;
}

export async function getPlayerAttempts(player?: string): Promise<AttemptRecord[]> {
  const target = player ?? getSessionAddress() ?? "";
  const all = read<AttemptRecord[]>(LS_ATT, []);
  return all.filter(a => a.player.toLowerCase() === target.toLowerCase());
}

// ---------------------------------------------------------------------------
// Leaderboard / headboard (canonical reads from the contract)
// ---------------------------------------------------------------------------

function parseLeaderboardJson(raw: any): LeaderboardRow[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const o = JSON.parse(raw);
    const entries = Array.isArray(o?.entries) ? o.entries : [];
    return entries.map((e: any, i: number) => ({
      rank: Number(e.rank ?? i + 1),
      player: String(e.player ?? ""),
      username: String(e.username ?? ""),
      score: Number(e.score ?? 0),
      attemptId: String(e.attempt_id ?? ""),
      timestamp: Number(e.timestamp ?? 0),
    }));
  } catch { return []; }
}

const LS_LB = "genbirds.leaderboard.v2";
function leaderboardLocal(levelId: string): LeaderboardRow[] {
  const all = read<AttemptRecord[]>(LS_ATT, []).filter(a => a.countsForLeaderboard && a.levelId === levelId);
  const bestByPlayer = new Map<string, AttemptRecord>();
  for (const a of all) {
    const prev = bestByPlayer.get(a.player);
    if (!prev || a.claimedScore > prev.claimedScore) bestByPlayer.set(a.player, a);
  }
  return [...bestByPlayer.values()]
    .sort((a, b) => b.claimedScore - a.claimedScore)
    .map((a, i) => ({
      rank: i + 1, player: a.player, username: a.username ?? "",
      score: a.claimedScore, attemptId: a.id, timestamp: a.timestamp,
    }));
}

export async function getLevelLeaderboard(levelId: string): Promise<LeaderboardRow[]> {
  // Refresh from chain in the background; never block the page.
  if (isContractConfigured()) {
    Promise.race([
      chainRead("get_level_leaderboard", [levelId]),
      chainRead("get_level_headboard", [levelId]),
    ]).then(raw => {
      const rows = parseLeaderboardJson(raw);
      if (rows.length) {
        const cache = read<Record<string, LeaderboardRow[]>>(LS_LB, {});
        cache[levelId] = rows;
        write(LS_LB, cache);
      }
    }).catch(() => {});
  }
  // Prefer cached chain rows if we have them, otherwise compute from local.
  const cache = read<Record<string, LeaderboardRow[]>>(LS_LB, {});
  return cache[levelId] && cache[levelId].length ? cache[levelId] : leaderboardLocal(levelId);
}

export async function getPlayerBest(levelId: string, address?: string): Promise<number> {
  const a = address ?? getSessionAddress();
  if (!a) return 0;
  const board = await getLevelLeaderboard(levelId);
  return board.find(r => r.player.toLowerCase() === a.toLowerCase())?.score ?? 0;
}
