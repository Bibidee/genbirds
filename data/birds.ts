export type BirdType =
  | "ruby" | "solar" | "aqua" | "boom" | "emerald" | "cloud" | "violet";

export interface BirdDef {
  type: BirdType;
  name: string;
  color: string;
  weight: number;
  damage: number;
  ability: string;
  description: string;
}

export const BIRDS: Record<BirdType, BirdDef> = {
  ruby:   { type: "ruby",    name: "Ruby Rocket",    color: "#ef3a3a", weight: 1.0, damage: 12, ability: "balanced",  description: "All-rounder striker. Reliable smash." },
  solar:  { type: "solar",   name: "Solar Beak",     color: "#ffd23f", weight: 0.8, damage: 14, ability: "dash",      description: "Mid-air dash: tap to double speed." },
  aqua:   { type: "aqua",    name: "Aqua Trio",      color: "#3aa7ef", weight: 0.6, damage: 8,  ability: "split",     description: "Splits into three on tap." },
  boom:   { type: "boom",    name: "Boombeak",       color: "#222831", weight: 1.4, damage: 28, ability: "explode",   description: "Delayed explosion on impact." },
  emerald:{ type: "emerald", name: "Emerald Arc",    color: "#5fcf52", weight: 0.9, damage: 10, ability: "curve",     description: "Tap to curve sharply mid-flight." },
  cloud:  { type: "cloud",   name: "Cloud Dropper",  color: "#f6f4ee", weight: 0.7, damage: 9,  ability: "drop",      description: "Drops an egg-bomb beneath it." },
  violet: { type: "violet",  name: "Violet Boulder", color: "#8b5cf6", weight: 2.2, damage: 22, ability: "heavy",     description: "Slow but devastating impact." },
};

export const BIRD_LIST: BirdDef[] = Object.values(BIRDS);
