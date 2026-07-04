import { GameState, LogItem } from './types/game';
import { ores, dungeonDepth, xpNeed, weightedOre, mine, chanceSummary } from './core/MiningEngine';
import { recipes, shopItems, canCraft, craft, buyShopItem, sellCommon } from './core/ForgeEngine';
import { defaultDungeon, explore, returnCamp, renderDungeonUI } from './core/DungeonEngine';
import { toggleBgm } from './audio/AudioEngine';
import { initSupabase, getCurrentUser, signOut, scheduleCloudSave, saveCloudNow, loadCloudSave } from './services/SupabaseService';

const $ = (id: string) => document.getElementById(id) as HTMLElement | null;

const defaultState: GameState = {
  minerLevel: 1,
  minerXp: 0,
  smithLevel: 1,
  smithXp: 0,
  mastery: 0,
  gold: 0,
  power: 1,
  rareBoost: 0,
  forgeBoost: 0,
  dungeon: JSON.parse(JSON.stringify(defaultDungeon)),
  shop: { owned: {} },
  crafted: {},
  inv: Object.fromEntries(ores.map(ore => [ore.id, 0])),
  log: ["광산 입구에 도착했습니다. 첫 곡괭이를 들어보세요."]
};

let state: GameState = loadState();

function cloneDefault(): GameState {
  return JSON.parse(JSON.stringify(defaultState));
}

function hydrateState(saved?: Partial<GameState>): GameState {
  const base = cloneDefault();
  return {
    ...base,
    ...(saved || {}),
    inv: { ...base.inv, ...(saved?.inv || {}) },
    dungeon: { ...base.dungeon, ...(saved?.dungeon || {}), visited: { ...base.dungeon?.visited, ...(saved?.dungeon?.visited || {}) } },
    shop: { ...base.shop, ...(saved?.shop || {}), owned: { ...base.shop?.owned, ...(saved?.shop?.owned || {}) } },
    crafted: saved?.crafted || {},
    log: saved?.log || base.log
  };
}

function loadState(): GameState {
  try {
    const saved = JSON.parse(localStorage.getItem("minerBlacksmithSave") || "");
    return hydrateState(saved);
  } catch {
    return cloneDefault();
  }
}

function saveState(showToast = true): void {
  localStorage.setItem("minerBlacksmithSave", JSON.stringify(state));
  scheduleCloudSave(() => state, (msg) => updateUserUI(msg));
  if (showToast) toast("저장되었습니다.");
}

function resetState(): void {
  if (!confirm("진행 상황을 모두 초기화할까요?")) return;
  state = cloneDefault();
  localStorage.removeItem("minerBlacksmithSave");
  scheduleCloudSave(() => state, (msg) => updateUserUI(msg));
  render();
  toast("새 게임을 시작합니다.");
}

function addLog(text: string, cls: string = ""): void {
  const time = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  state.log.unshift({ text, cls, time });
  state.log = state.log.slice(0, 80);
}

function toast(text: string): void {
  const toastEl = $("toast");
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout((toast as unknown as { timer: number }).timer);
  (toast as unknown as { timer: number }).timer = window.setTimeout(() => toastEl.classList.remove("show"), 1800);
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString("ko-KR");
const compactFormat = (num: number) => {
  const value = Math.floor(Number(num) || 0);
  if (value < 100000) return value.toLocaleString("ko-KR");
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
};

function renderInventory(): void {
  const invEl = $("inventory");
  if (!invEl) return;
  invEl.innerHTML = ores.map(ore => `
    <div class="ore-row">
      <div class="ore-chip" style="background:${ore.color}33;color:${ore.color}">${ore.icon}</div>
      <div>
        <div class="name">${ore.name}</div>
        <div class="hint">등급 ${ore.tier} · 판매가 ${formatNumber(ore.value)} 골드</div>
      </div>
      <div class="count" title="${formatNumber(state.inv[ore.id] || 0)}">${compactFormat(state.inv[ore.id] || 0)}</div>
    </div>
  `).join("");
}

function renderShop(): void {
  const shopEl = $("shopList");
  if (!shopEl) return;
  shopEl.innerHTML = shopItems.map(item => {
    const owned = !!state.shop.owned[item.id];
    const affordable = state.gold >= item.cost;
    const bonus = [
      `채광력 +${item.power}`,
      item.rareBoost ? `희귀 확률 +${Math.round(item.rareBoost * 100)}%` : ""
    ].filter(Boolean).join(" · ");
    return `
      <div class="recipe-row">
        <div>
          <div class="name">${item.name} ${owned ? `<span class="hint">보유중</span>` : ""}</div>
          <div class="hint">${bonus}</div>
          <div class="hint">${item.desc}</div>
        </div>
        <button class="btn" ${owned || !affordable ? "disabled" : ""} data-item-id="${item.id}">
          ${owned ? "구매 완료" : `${formatNumber(item.cost)}G`}
        </button>
      </div>
    `;
  }).join("");

  shopEl.querySelectorAll("button[data-item-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLElement).dataset.itemId;
      if (id && buyShopItem(state, id, addLog, toast, formatNumber)) {
        render();
      }
    });
  });
}

function renderRecipes(): void {
  const selectEl = $("recipeSelect") as HTMLSelectElement | null;
  const listEl = $("recipeList");
  if (!selectEl || !listEl) return;

  selectEl.innerHTML = recipes.map(recipe => {
    const locked = state.smithLevel < recipe.level ? "잠김" : "제작 가능";
    return `<option value="${recipe.id}">${recipe.name} · Lv.${recipe.level} · ${locked}</option>`;
  }).join("");

  listEl.innerHTML = recipes.map(recipe => {
    const needs = Object.entries(recipe.needs)
      .map(([id, amount]) => {
        const ore = ores.find(item => item.id === id);
        const owned = state.inv[id] || 0;
        const enough = owned >= amount;
        const exact = `${ore?.name} ${formatNumber(owned)}/${formatNumber(amount)}`;
        return `<span class="${enough ? "success" : "fail"}" title="${exact}">${ore?.name} ${compactFormat(owned)}/${compactFormat(amount)}</span>`;
      }).join("");
    const locked = state.smithLevel < recipe.level;
    return `
      <div class="recipe-row">
        <div>
          <div class="name">${recipe.name} ${state.crafted[recipe.id] ? `<span class="hint">x${state.crafted[recipe.id]}</span>` : ""}</div>
          <div class="hint">필요 레벨 ${recipe.level}</div>
          <div class="hint need-list">${needs}</div>
          <div class="hint">${recipe.unlock}</div>
        </div>
        <button class="btn" ${locked || !canCraft(recipe, state.inv) ? "disabled" : ""} data-recipe-id="${recipe.id}">제작</button>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll("button[data-recipe-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLElement).dataset.recipeId;
      if (id && craft(state, id, addLog, toast)) {
        render();
      }
    });
  });
}

function renderLog(): void {
  const logEl = $("log");
  if (!logEl) return;
  logEl.innerHTML = state.log.map(item => {
    if (typeof item === "string") return `<div class="log-row">${item}</div>`;
    const logObj = item as LogItem;
    return `<div class="log-row ${logObj.cls || ""}"><span>${logObj.time} · ${logObj.text}</span></div>`;
  }).join("");
}

function render(): void {
  const minerLevel = $("minerLevel");
  const smithLevel = $("smithLevel");
  const gold = $("gold");
  const power = $("power");
  const mastery = $("mastery");
  const depth = $("depth");
  const minerXp = $("minerXp");
  const smithXp = $("smithXp");
  const mineChance = $("mineChance");
  const forgeChance = $("forgeChance");

  if (minerLevel) minerLevel.textContent = `${state.minerLevel}`;
  if (smithLevel) smithLevel.textContent = `${state.smithLevel}`;
  if (gold) gold.textContent = compactFormat(state.gold);
  if (power) power.textContent = `${state.power}`;
  if (mastery) mastery.textContent = compactFormat(state.mastery);
  if (depth) depth.textContent = `${dungeonDepth(state)}층`;

  if (minerXp) minerXp.style.width = `${(state.minerXp / xpNeed(state.minerLevel)) * 100}%`;
  if (smithXp) smithXp.style.width = `${(state.smithXp / xpNeed(state.smithLevel)) * 100}%`;
  if (mineChance) mineChance.textContent = `특수금속 예상 ${chanceSummary(state)}%`;

  const successRate = Math.min(95, 48 + state.smithLevel * 4.5 + state.mastery * .3 + state.forgeBoost * 100);
  if (forgeChance) forgeChance.textContent = `기본 성공률 ${successRate.toFixed(0)}%`;

  renderDungeonUI(state);
  renderInventory();
  renderShop();
  renderRecipes();
  renderLog();
  saveState(false);
}

function updateUserUI(customSyncMsg = ""): void {
  const user = getCurrentUser();
  const badge = $("userBadge");
  const sync = $("syncStatus");

  if (user) {
    if (badge) {
      badge.className = "user-badge";
      badge.textContent = `👤 ${user.email || "플레이어"}`;
    }
    if (sync) sync.textContent = customSyncMsg || "클라우드 자동 저장 활성화";
  } else {
    if (badge) {
      badge.className = "user-badge guest-mode";
      badge.textContent = "🎮 게스트 플레이어";
    }
    if (sync) sync.textContent = customSyncMsg || "로컬 브라우저 저장 사용 중";
  }
}

function updateBgmBtnUI(playing: boolean): void {
  const btn = $("bgmBtn");
  if (!btn) return;
  btn.textContent = playing ? "BGM 켜짐" : "BGM 꺼짐";
  btn.classList.toggle("hot", playing);
}

document.addEventListener("DOMContentLoaded", () => {
  $("mineBtn")?.addEventListener("click", () => { mine(state, 1, addLog, toast); render(); });
  $("bulkMineBtn")?.addEventListener("click", () => { mine(state, 10, addLog, toast); render(); });
  $("northBtn")?.addEventListener("click", () => { explore(state, "north", addLog); render(); });
  $("southBtn")?.addEventListener("click", () => { explore(state, "south", addLog); render(); });
  $("eastBtn")?.addEventListener("click", () => { explore(state, "east", addLog); render(); });
  $("westBtn")?.addEventListener("click", () => { explore(state, "west", addLog); render(); });
  $("deeperBtn")?.addEventListener("click", () => { explore(state, "deeper", addLog); render(); });
  $("campBtn")?.addEventListener("click", () => { returnCamp(state, addLog); render(); });
  $("sellBtn")?.addEventListener("click", () => { sellCommon(state, addLog, formatNumber); render(); });

  $("shopOpenBtn")?.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    document.querySelector('[data-tab="shop"]')?.classList.add("active");
    $("inventoryTab")?.classList.add("hidden");
    $("shopTab")?.classList.remove("hidden");
    $("logTab")?.classList.add("hidden");
  });

  $("craftBtn")?.addEventListener("click", () => {
    const select = $("recipeSelect") as HTMLSelectElement | null;
    if (select && craft(state, select.value, addLog, toast)) {
      render();
    }
  });

  $("bgmBtn")?.addEventListener("click", () => {
    const playing = toggleBgm((p) => updateBgmBtnUI(p));
    toast(playing ? "BGM 켜짐" : "BGM 꺼짐");
  });

  $("logoutBtn")?.addEventListener("click", async () => {
    await signOut();
    localStorage.removeItem("minerBlacksmithGuest");
    toast("로그인 페이지로 이동합니다.");
    setTimeout(() => { window.location.href = "login.html"; }, 400);
  });

  $("cloudSaveBtn")?.addEventListener("click", async () => {
    const user = getCurrentUser();
    if (!user) {
      toast("로그인한 플레이어만 클라우드 저장을 사용할 수 있습니다.");
      return;
    }
    const success = await saveCloudNow(state, (msg) => updateUserUI(msg));
    if (success) toast("클라우드에 저장되었습니다.");
  });

  $("saveBtn")?.addEventListener("click", () => saveState(true));
  $("resetBtn")?.addEventListener("click", resetState);

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
      tab.classList.add("active");
      const tabName = (tab as HTMLElement).dataset.tab;
      $("inventoryTab")?.classList.toggle("hidden", tabName !== "inventory");
      $("shopTab")?.classList.toggle("hidden", tabName !== "shop");
      $("logTab")?.classList.toggle("hidden", tabName !== "log");
    });
  });

  render();

  initSupabase(
    (user, shouldLoadCloud) => {
      updateUserUI();
      if (user && shouldLoadCloud) {
        loadCloudSave((cloudState) => {
          state = hydrateState(cloudState);
          saveState(false);
          render();
        }, (msg) => updateUserUI(msg));
      }
    },
    (statusMsg) => updateUserUI(statusMsg)
  );
});
