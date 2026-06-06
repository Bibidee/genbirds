import { defineChain } from "viem";

// The browser must NEVER hold the upstream RPC URL. We always point at the
// same-origin proxy under /api/genlayer-rpc, which the server forwards to the
// real GenLayer RPC using the server-only env GENLAYER_RPC_URL.
const RPC = (process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "/api/genlayer-rpc").trim();
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || 61999);

// viem requires absolute URLs in its rpcUrls. Build one against the current
// origin on the client so the chain object is valid while still pointing at
// the proxy. On the server (SSR) fall back to a stub localhost URL — RPC is
// never used during prerender.
function browserAbsoluteRpc(): string {
  if (RPC.startsWith("http")) return RPC;
  if (typeof window !== "undefined") return window.location.origin + RPC;
  return "http://localhost" + RPC;
}

export const genlayerStudionet = defineChain({
  id: CHAIN_ID,
  name: "GenLayer StudioNet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: [browserAbsoluteRpc()] },
    public: { http: [browserAbsoluteRpc()] },
  },
});

// What the genlayer client should actually be told to call. Always the proxy
// (or whatever NEXT_PUBLIC_GENLAYER_RPC_URL evaluates to — for local
// non-Next test setups, that can also be /api/genlayer-rpc).
export const GENLAYER_RPC = RPC;
export const GENLAYER_CHAIN_ID = CHAIN_ID;
