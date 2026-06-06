import { BirdType } from "./birds";

export type BlockKind = "wood" | "stone" | "ice";
export interface Block { x: number; y: number; w: number; h: number; kind: BlockKind; }
export interface Enemy { x: number; y: number; r: number; hp: number; }

export interface Level {
  id: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  birds: BirdType[];
  blocks: Block[];
  enemies: Enemy[];
  maxScore: number;
  hash: string;
}

const L = (id: string, name: string, difficulty: Level["difficulty"], birds: BirdType[], blocks: Block[], enemies: Enemy[]): Level => {
  // Must match GameCanvas scoring: enemy*1000 + block*100 + completion 1500 + unused*500
  const maxScore = enemies.length * 1000 + blocks.length * 100 + 1500 + birds.length * 500;
  const hash = "lvl_" + id + "_" + (blocks.length * 31 + enemies.length * 97 + birds.length).toString(16);
  return { id, name, difficulty, birds, blocks, enemies, maxScore, hash };
};

export const LEVELS: Level[] = [
  L("1-1", "First Flight", "easy",
    ["ruby", "ruby", "solar"],
    [
      { x: 720, y: 480, w: 20, h: 120, kind: "wood" },
      { x: 820, y: 480, w: 20, h: 120, kind: "wood" },
      { x: 770, y: 415, w: 120, h: 20, kind: "wood" },
    ],
    [{ x: 770, y: 540, r: 22, hp: 1 }]),

  L("1-2", "Twin Towers", "easy",
    ["ruby", "solar", "ruby"],
    [
      { x: 680, y: 480, w: 20, h: 120, kind: "wood" },
      { x: 740, y: 480, w: 20, h: 120, kind: "wood" },
      { x: 710, y: 415, w: 80, h: 20, kind: "stone" },
      { x: 860, y: 480, w: 20, h: 120, kind: "wood" },
      { x: 920, y: 480, w: 20, h: 120, kind: "wood" },
      { x: 890, y: 415, w: 80, h: 20, kind: "stone" },
    ],
    [{ x: 710, y: 540, r: 22, hp: 1 }, { x: 890, y: 540, r: 22, hp: 1 }]),

  L("1-3", "Glass Fortress", "medium",
    ["ruby", "aqua", "boom"],
    [
      // Floor of the fortress, enemies sit on top of it.
      { x: 810, y: 560, w: 240, h: 16, kind: "ice" },
      // Pillars
      { x: 700, y: 480, w: 16, h: 80, kind: "ice" },
      { x: 920, y: 480, w: 16, h: 80, kind: "ice" },
      // Roof
      { x: 810, y: 432, w: 240, h: 16, kind: "stone" },
    ],
    [
      { x: 760, y: 530, r: 18, hp: 1 },
      { x: 860, y: 530, r: 18, hp: 1 },
      { x: 810, y: 410, r: 20, hp: 1 },
    ]),

  L("2-1", "Boomtime", "medium",
    ["boom", "violet", "emerald"],
    [
      // Lower deck
      { x: 790, y: 560, w: 220, h: 20, kind: "stone" },
      { x: 690, y: 500, w: 20, h: 100, kind: "stone" },
      { x: 890, y: 500, w: 20, h: 100, kind: "stone" },
      // Upper deck
      { x: 790, y: 438, w: 220, h: 20, kind: "wood" },
    ],
    [
      { x: 790, y: 528, r: 22, hp: 2 },
      { x: 790, y: 410, r: 20, hp: 1 },
    ]),

  L("2-2", "Skyscraper", "hard",
    ["ruby", "solar", "violet", "boom"],
    [
      // Thicker pillars + center column = stable stack that only falls when hit.
      // Floor 1
      { x: 840, y: 588, w: 240, h: 18, kind: "stone" },
      { x: 740, y: 528, w: 28, h: 100, kind: "stone" },
      { x: 840, y: 528, w: 22, h: 100, kind: "wood" },
      { x: 940, y: 528, w: 28, h: 100, kind: "stone" },
      // Floor 2
      { x: 840, y: 462, w: 240, h: 18, kind: "stone" },
      { x: 760, y: 408, w: 24, h: 90, kind: "wood" },
      { x: 920, y: 408, w: 24, h: 90, kind: "wood" },
      // Floor 3
      { x: 840, y: 348, w: 220, h: 18, kind: "stone" },
      { x: 770, y: 296, w: 22, h: 86, kind: "ice" },
      { x: 910, y: 296, w: 22, h: 86, kind: "ice" },
      // Roof
      { x: 840, y: 240, w: 220, h: 18, kind: "stone" },
    ],
    [
      // Enemies tucked between supports so the player has to actually aim.
      { x: 800, y: 558, r: 18, hp: 2 },
      { x: 880, y: 558, r: 18, hp: 2 },
      { x: 840, y: 432, r: 20, hp: 2 },
      { x: 840, y: 318, r: 22, hp: 3 },
      { x: 840, y: 210, r: 24, hp: 3 },
    ]),
];

export function getLevel(id: string) { return LEVELS.find(l => l.id === id); }
