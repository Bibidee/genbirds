import { hashJSON, hashString } from "./hashing";

export interface Launch {
  birdType: string;
  angle: number;
  power: number;
  timestamp: number;
}

export interface ReplayMeta {
  levelId: string;
  levelHash: string;
  birdsUsed: number;
  launches: Launch[];
  claimedScore: number;
  enemiesDestroyed: number;
  blocksDestroyed: number;
  remainingBirds: number;
  physicsSummaryHash: string;
  replayHash: string;
}

export function buildReplay(opts: Omit<ReplayMeta, "physicsSummaryHash" | "replayHash">): ReplayMeta {
  const physicsSummaryHash = hashJSON({
    e: opts.enemiesDestroyed, b: opts.blocksDestroyed, s: opts.claimedScore, u: opts.birdsUsed,
  });
  const replayHash = hashString(
    [opts.levelHash, opts.birdsUsed, opts.claimedScore, physicsSummaryHash,
     ...opts.launches.map(l => `${l.birdType}|${l.angle.toFixed(3)}|${l.power.toFixed(3)}|${l.timestamp}`)].join(":"));
  return { ...opts, physicsSummaryHash, replayHash };
}
