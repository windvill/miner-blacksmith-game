import { RoomType, DungeonState, GameState } from '../types/game';
import { dungeonDepth } from './MiningEngine';

export const roomTypes: RoomType[] = [
  { name: "광산 입구", desc: "따뜻한 공기와 이어진 안전한 갱도입니다.", vein: 2, danger: 0, depth: 0 },
  { name: "구리빛 갈림길", desc: "벽면에 구리 광맥이 길게 이어져 있습니다.", vein: 3, danger: 1, depth: 0 },
  { name: "젖은 석회 동굴", desc: "발밑은 미끄럽지만 광석 흔적이 많습니다.", vein: 3, danger: 2, depth: 1 },
  { name: "버려진 광부 야영지", desc: "오래된 도구와 꺼진 화로가 남아 있습니다.", vein: 2, danger: 1, depth: 1 },
  { name: "푸른 수정 광맥", desc: "미스릴 기운이 희미하게 새어 나옵니다.", vein: 4, danger: 3, depth: 2 },
  { name: "무너진 채굴장", desc: "낙석 위험은 있지만 깊은 광맥이 드러나 있습니다.", vein: 5, danger: 4, depth: 3 },
  { name: "고대 용광로터", desc: "대장장이들의 열기가 아직 벽에 남아 있습니다.", vein: 4, danger: 3, depth: 3 },
  { name: "별빛 보석 광맥", desc: "아주 희귀한 금속이 나올 수 있는 깊은 방입니다.", vein: 6, danger: 5, depth: 5 }
];

export const defaultDungeon: DungeonState = {
  x: 0,
  y: 0,
  depth: 1,
  room: "광산 입구",
  desc: "따뜻한 공기와 이어진 안전한 갱도입니다.",
  danger: 0,
  vein: 2,
  maxVein: 2,
  visited: { "0,0": true }
};

export function chooseRoom(state: GameState, extraDepth: number = 0): RoomType & { maxVein: number } {
  const targetDepth = dungeonDepth(state) + extraDepth;
  const candidates = roomTypes.filter(room => room.depth <= targetDepth + 1);
  const pool = candidates.length ? candidates : roomTypes;
  const room = pool[Math.floor(Math.random() * pool.length)];
  const bonus = Math.max(0, state.dungeon.depth - 1);
  const maxVein = room.vein + Math.floor(Math.random() * 2) + Math.floor(bonus / 3);
  return { ...room, maxVein };
}

export function explore(
  state: GameState,
  direction: 'north' | 'south' | 'east' | 'west' | 'deeper',
  addLogFn: (text: string, cls?: string) => void
): void {
  const deltas: Record<string, [number, number]> = {
    north: [0, -1],
    south: [0, 1],
    west: [-1, 0],
    east: [1, 0],
    deeper: [0, 0]
  };
  const [dx, dy] = deltas[direction] || [0, 0];

  if (direction === "deeper") {
    state.dungeon.depth += 1;
  } else {
    state.dungeon.x += dx;
    state.dungeon.y += dy;
    if (Math.random() < 0.28) state.dungeon.depth += 1;
  }

  const room = chooseRoom(state, direction === "deeper" ? 2 : 0);
  state.dungeon.room = room.name;
  state.dungeon.desc = room.desc;
  state.dungeon.danger = Math.min(9, room.danger + Math.floor(state.dungeon.depth / 3));
  state.dungeon.vein = room.maxVein;
  state.dungeon.maxVein = room.maxVein;
  state.dungeon.visited[`${state.dungeon.x},${state.dungeon.y}`] = true;

  if (Math.random() < state.dungeon.danger * 0.035) {
    const lost = Math.min(state.gold, Math.floor(state.dungeon.danger * (2 + Math.random() * 5)));
    state.gold -= lost;
    addLogFn(`${state.dungeon.room}: 낙석을 피해 이동했습니다.${lost ? ` 수리비 ${lost}골드` : ""}`, "fail");
  } else {
    addLogFn(`${state.dungeon.room}을 발견했습니다. 광맥 ${state.dungeon.vein}개`, state.dungeon.danger >= 4 ? "rare" : "");
  }
}

export function returnCamp(state: GameState, addLogFn: (text: string, cls?: string) => void): void {
  state.dungeon = JSON.parse(JSON.stringify(defaultDungeon));
  addLogFn("따뜻한 입구로 돌아왔습니다. 장비를 살피고 다시 내려갈 수 있습니다.", "success");
}

export function renderDungeonUI(state: GameState): void {
  const roomName = document.getElementById("roomName");
  const roomDesc = document.getElementById("roomDesc");
  const dungeonDepthEl = document.getElementById("dungeonDepth");
  const dangerLevel = document.getElementById("dangerLevel");
  const veinText = document.getElementById("veinText");
  const veinFill = document.getElementById("veinFill");
  const miniMap = document.getElementById("miniMap");

  if (roomName) roomName.textContent = state.dungeon.room;
  if (roomDesc) roomDesc.textContent = state.dungeon.desc;
  if (dungeonDepthEl) dungeonDepthEl.textContent = `${state.dungeon.depth}층`;
  if (dangerLevel) dangerLevel.textContent = `${state.dungeon.danger}`;
  if (veinText) veinText.textContent = `${state.dungeon.vein}/${state.dungeon.maxVein}`;
  if (veinFill) veinFill.style.width = `${state.dungeon.maxVein ? (state.dungeon.vein / state.dungeon.maxVein) * 100 : 0}%`;

  if (miniMap) {
    const cells: string[] = [];
    for (let y = state.dungeon.y - 1; y <= state.dungeon.y + 1; y++) {
      for (let x = state.dungeon.x - 1; x <= state.dungeon.x + 1; x++) {
        const key = `${x},${y}`;
        const cls = x === state.dungeon.x && y === state.dungeon.y ? "current" : state.dungeon.visited[key] ? "visited" : "";
        cells.push(`<div class="map-cell ${cls}"></div>`);
      }
    }
    miniMap.innerHTML = cells.join("");
  }
}
