import { Ore, GameState } from '../types/game';
import { playMineSound } from '../audio/AudioEngine';

export const ores: Ore[] = [
  { id: "stone", name: "돌", icon: "◆", color: "#777f82", tier: 1, value: 1, base: 52 },
  { id: "copper", name: "구리", icon: "●", color: "#c67b44", tier: 1, value: 3, base: 28 },
  { id: "iron", name: "철", icon: "⬟", color: "#b8c3c8", tier: 2, value: 7, base: 13 },
  { id: "silver", name: "은", icon: "✦", color: "#dce8ef", tier: 3, value: 18, base: 4.6 },
  { id: "mithril", name: "미스릴", icon: "✧", color: "#6fd7ff", tier: 4, value: 55, base: 1.6 },
  { id: "adamant", name: "아다만트", icon: "✺", color: "#a68cff", tier: 5, value: 140, base: .55 },
  { id: "orichalcum", name: "오리하르콘", icon: "✹", color: "#ffcf61", tier: 6, value: 360, base: .16 },
  { id: "starsteel", name: "성철", icon: "✷", color: "#f47eff", tier: 7, value: 900, base: .045 }
];

export function xpNeed(level: number): number {
  return Math.floor(35 + level * level * 17);
}

export function dungeonDepth(state: GameState): number {
  return Math.floor(state.minerLevel / 2) + state.power + Math.max(0, state.dungeon.depth - 1);
}

export function weightedOre(state: GameState): Ore {
  const depth = dungeonDepth(state);
  const weights = ores.map(ore => {
    const tierPenalty = Math.max(0, ore.tier - 1);
    const levelBoost = 1 + (state.minerLevel - 1) * (0.16 + tierPenalty * 0.035);
    const depthBoost = 1 + Math.max(0, depth - ore.tier) * 0.11;
    const dungeonBoost = 1 + Math.max(0, state.dungeon.danger) * (ore.tier >= 4 ? 0.09 : 0.025);
    const rareBonus = ore.tier >= 4 ? 1 + state.rareBoost + state.minerLevel * 0.018 : 1;
    const lockedPenalty = state.minerLevel + state.power < ore.tier ? 0.08 : 1;
    return Math.max(0.001, ore.base * levelBoost * depthBoost * dungeonBoost * rareBonus * lockedPenalty);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < ores.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return ores[i];
  }
  return ores[0];
}

export function addXp(state: GameState, kind: 'miner' | 'smith', amount: number, addLogFn: (text: string, cls?: string) => void): void {
  const xpKey = kind === 'miner' ? 'minerXp' : 'smithXp';
  const levelKey = kind === 'miner' ? 'minerLevel' : 'smithLevel';
  state[xpKey] += amount;
  while (state[xpKey] >= xpNeed(state[levelKey])) {
    state[xpKey] -= xpNeed(state[levelKey]);
    state[levelKey] += 1;
    addLogFn(`${kind === 'miner' ? '광부' : '대장장이'} 레벨이 ${state[levelKey]}이 되었습니다.`, 'success');
  }
}

export function mine(state: GameState, times: number = 1, addLogFn: (text: string, cls?: string) => void, toastFn: (msg: string) => void): boolean {
  if (state.dungeon.vein <= 0) {
    toastFn("이 방의 광맥은 고갈되었습니다. 다른 방을 탐험하세요.");
    addLogFn(`${state.dungeon.room}: 광맥이 고갈되었습니다.`, "fail");
    return false;
  }

  const mineCount = Math.min(times, state.dungeon.vein);
  const finds: Record<string, number> = {};
  for (let i = 0; i < mineCount; i++) {
    const ore = weightedOre(state);
    const amount = ore.tier <= 2 ? 1 + Math.floor(Math.random() * Math.max(1, state.power)) : 1;
    state.inv[ore.id] = (state.inv[ore.id] || 0) + amount;
    finds[ore.id] = (finds[ore.id] || 0) + amount;
    state.dungeon.vein -= 1;
    addXp(state, "miner", 5 + ore.tier * 3, addLogFn);
  }

  const text = Object.entries(finds)
    .map(([id, amount]) => `${ores.find(ore => ore.id === id)?.name} ${amount}개`)
    .join(", ");
  const rare = Object.keys(finds).some(id => (ores.find(ore => ore.id === id)?.tier || 0) >= 5);
  addLogFn(`${state.dungeon.room} 채광: ${text}`, rare ? "rare" : "");
  if (state.dungeon.vein <= 0) addLogFn(`${state.dungeon.room}의 광맥을 모두 캤습니다.`, "gold");
  animateMine();
  return true;
}

let mineAnimTimer: number | null = null;

export function animateMine(): void {
  const scene = document.querySelector(".mine-scene");
  const miner = document.getElementById("minerSvg");
  const debris = document.getElementById("debris");
  const impactRing = document.getElementById("impactRing");
  const spark = document.getElementById("spark");

  playMineSound();
  
  if (scene) scene.classList.remove("hit");
  if (miner) miner.classList.remove("mining");
  if (spark) spark.classList.remove("show");
  if (debris) debris.classList.remove("show");
  if (impactRing) impactRing.classList.remove("show");

  if (miner) void miner.offsetWidth;

  if (scene) scene.classList.add("hit");
  if (miner) miner.classList.add("mining");
  if (spark) spark.classList.add("show");
  if (debris) debris.classList.add("show");
  if (impactRing) impactRing.classList.add("show");

  if (mineAnimTimer !== null) clearTimeout(mineAnimTimer);
  mineAnimTimer = window.setTimeout(() => {
    if (scene) scene.classList.remove("hit");
    if (miner) miner.classList.remove("mining");
    if (spark) spark.classList.remove("show");
    if (debris) debris.classList.remove("show");
    if (impactRing) impactRing.classList.remove("show");
  }, 820);
}

export function chanceSummary(state: GameState): string {
  const trials = 1200;
  const counts: Record<string, number> = {};
  for (let i = 0; i < trials; i++) {
    const ore = weightedOre(state);
    counts[ore.id] = (counts[ore.id] || 0) + 1;
  }
  const rareChance = ores
    .filter(ore => ore.tier >= 5)
    .reduce((sum, ore) => sum + (counts[ore.id] || 0), 0) / trials * 100;
  return Math.max(.01, rareChance).toFixed(2);
}
