import { Recipe, ShopItem, GameState } from '../types/game';
import { ores, addXp } from './MiningEngine';

export const recipes: Recipe[] = [
  { id: "copperIngot", name: "구리 주괴", level: 1, xp: 8, mastery: 2, gold: 4, needs: { copper: 3, stone: 1 }, unlock: "초급 제작" },
  { id: "ironPick", name: "철 곡괭이", level: 2, xp: 18, mastery: 5, gold: 16, needs: { iron: 5, copper: 3 }, power: 1, unlock: "채광력 +1" },
  { id: "silverCharm", name: "은 부적", level: 3, xp: 34, mastery: 10, gold: 35, needs: { silver: 4, iron: 4 }, rareBoost: .08, unlock: "희귀 금속 확률 상승" },
  { id: "mithrilHammer", name: "미스릴 망치", level: 5, xp: 70, mastery: 18, gold: 90, needs: { mithril: 3, silver: 5, iron: 8 }, forgeBoost: .08, unlock: "제작 성공률 상승" },
  { id: "adamantDrill", name: "아다만트 드릴", level: 7, xp: 125, mastery: 32, gold: 210, needs: { adamant: 2, mithril: 5, iron: 15 }, power: 3, unlock: "채광력 +3" },
  { id: "orichalcumCrown", name: "오리하르콘 왕관", level: 10, xp: 220, mastery: 55, gold: 620, needs: { orichalcum: 2, adamant: 3, silver: 12 }, rareBoost: .15, unlock: "희귀 금속 확률 크게 상승" },
  { id: "starsteelCore", name: "성철 코어", level: 14, xp: 420, mastery: 90, gold: 1600, needs: { starsteel: 1, orichalcum: 2, mithril: 10 }, power: 6, forgeBoost: .12, unlock: "최종 장비" }
];

export const shopItems: ShopItem[] = [
  { id: "sturdyPick", name: "튼튼한 곡괭이", cost: 90, power: 1, rareBoost: 0, desc: "기본 채광력을 올려 초반 탐험을 빠르게 합니다." },
  { id: "ironPickShop", name: "철제 광부 곡괭이", cost: 240, power: 2, rareBoost: .02, desc: "깊은 길에서도 광맥을 안정적으로 캡니다." },
  { id: "prospectorPick", name: "탐광꾼 곡괭이", cost: 520, power: 3, rareBoost: .06, desc: "희귀 금속을 찾는 감각이 좋아집니다." },
  { id: "mithrilPick", name: "미스릴 곡괭이", cost: 1200, power: 5, rareBoost: .12, desc: "푸른 광맥과 보석 광맥에 강합니다." },
  { id: "orichalcumPick", name: "오리하르콘 곡괭이", cost: 2800, power: 8, rareBoost: .22, desc: "던전 깊은 곳의 특수 금속을 노립니다." }
];

export function canCraft(recipe: Recipe, inv: Record<string, number>): boolean {
  return Object.entries(recipe.needs).every(([id, amount]) => (inv[id] || 0) >= amount);
}

export function craft(
  state: GameState,
  recipeId: string,
  addLogFn: (text: string, cls?: string) => void,
  toastFn: (msg: string) => void
): boolean {
  const recipe = recipes.find(item => item.id === recipeId);
  if (!recipe) return false;

  if (state.smithLevel < recipe.level) {
    toastFn(`대장장이 레벨 ${recipe.level}부터 제작할 수 있습니다.`);
    return false;
  }
  if (!canCraft(recipe, state.inv)) {
    toastFn("재료가 부족합니다.");
    return false;
  }

  animateForge();
  Object.entries(recipe.needs).forEach(([id, amount]) => {
    state.inv[id] = (state.inv[id] || 0) - amount;
  });

  const successRate = Math.min(.95, .48 + state.smithLevel * .045 + state.mastery * .003 + state.forgeBoost);
  const success = Math.random() < successRate;
  
  addXp(state, "smith", recipe.xp, addLogFn);
  state.mastery += recipe.mastery;

  if (success) {
    state.gold += recipe.gold;
    if (recipe.power) state.power += recipe.power;
    if (recipe.rareBoost) state.rareBoost += recipe.rareBoost;
    if (recipe.forgeBoost) state.forgeBoost += recipe.forgeBoost;
    state.crafted[recipe.id] = (state.crafted[recipe.id] || 0) + 1;
    addLogFn(`${recipe.name} 제작 성공! ${recipe.unlock}`, "success");
    toastFn(`${recipe.name} 제작 성공`);
  } else {
    state.mastery += 2;
    addLogFn(`${recipe.name} 제작 실패. 그래도 숙련도가 올랐습니다.`, "fail");
    toastFn("제작 실패. 다음 망치질은 더 좋아집니다.");
  }
  return true;
}

export function buyShopItem(
  state: GameState,
  itemId: string,
  addLogFn: (text: string, cls?: string) => void,
  toastFn: (msg: string) => void,
  formatFn: (num: number) => string
): boolean {
  const item = shopItems.find(entry => entry.id === itemId);
  if (!item || state.shop.owned[item.id]) return false;
  if (state.gold < item.cost) {
    toastFn(`${item.name} 구매에는 ${formatFn(item.cost)} 골드가 필요합니다.`);
    return false;
  }

  state.gold -= item.cost;
  state.power += item.power;
  state.rareBoost += item.rareBoost || 0;
  state.shop.owned[item.id] = true;
  addLogFn(`${item.name}을 구매했습니다. 채광력 +${item.power}`, "success");
  toastFn(`${item.name} 구매 완료`);
  return true;
}

export function sellCommon(
  state: GameState,
  addLogFn: (text: string, cls?: string) => void,
  formatFn: (num: number) => string
): void {
  let gained = 0;
  ores.filter(ore => ore.tier <= 3).forEach(ore => {
    const amount = state.inv[ore.id] || 0;
    gained += amount * ore.value;
    state.inv[ore.id] = 0;
  });
  state.gold += gained;
  addLogFn(gained ? `흔한 광석을 팔아 ${formatFn(gained)} 골드를 벌었습니다.` : "팔 수 있는 흔한 광석이 없습니다.", gained ? "gold" : "");
}

let forgeAnimTimer: number | null = null;

export function animateForge(): void {
  const forge = document.querySelector(".forge");
  if (!forge) return;
  forge.classList.remove("striking");
  void (forge as HTMLElement).offsetWidth;
  forge.classList.add("striking");
  if (forgeAnimTimer !== null) clearTimeout(forgeAnimTimer);
  forgeAnimTimer = window.setTimeout(() => forge.classList.remove("striking"), 820);
}
