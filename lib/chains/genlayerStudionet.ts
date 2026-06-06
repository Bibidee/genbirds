import { defineChain } from "viem";

const RPC = (process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studionet.genlayer.com/api").trim();
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || 61999);

export const genlayerStudionet = defineChain({
  id: CHAIN_ID,
  name: "GenLayer StudioNet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC] },
    public: { http: [RPC] },
  },
});

export const GENLAYER_RPC = RPC;
export const GENLAYER_CHAIN_ID = CHAIN_ID;
