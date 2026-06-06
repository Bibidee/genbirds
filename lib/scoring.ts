export interface ScoreInput {
  enemiesDestroyed: number;
  blocksDestroyed: number;
  birdsUsed: number;
  totalBirds: number;
  levelComplete: boolean;
}
export function calcScore(i: ScoreInput): number {
  const enemyPts = i.enemiesDestroyed * 1000;
  const blockPts = i.blocksDestroyed * 100;
  const unusedBonus = i.levelComplete ? (i.totalBirds - i.birdsUsed) * 500 : 0;
  const completion = i.levelComplete ? 1500 : 0;
  return enemyPts + blockPts + unusedBonus + completion;
}
