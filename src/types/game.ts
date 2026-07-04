export interface Ore {
  id: string;
  name: string;
  icon: string;
  color: string;
  tier: number;
  value: number;
  base: number;
}

export interface Recipe {
  id: string;
  name: string;
  level: number;
  xp: number;
  mastery: number;
  gold: number;
  needs: Record<string, number>;
  power?: number;
  rareBoost?: number;
  forgeBoost?: number;
  unlock: string;
}

export interface ShopItem {
  id: string;
  name: string;
  cost: number;
  power: number;
  rareBoost: number;
  desc: string;
}

export interface RoomType {
  name: string;
  desc: string;
  vein: number;
  danger: number;
  depth: number;
}

export interface DungeonState {
  x: number;
  y: number;
  depth: number;
  room: string;
  desc: string;
  danger: number;
  vein: number;
  maxVein: number;
  visited: Record<string, boolean>;
}

export interface LogItem {
  text: string;
  cls?: string;
  time?: string;
}

export interface GameState {
  minerLevel: number;
  minerXp: number;
  smithLevel: number;
  smithXp: number;
  mastery: number;
  gold: number;
  power: number;
  rareBoost: number;
  forgeBoost: number;
  dungeon: DungeonState;
  shop: {
    owned: Record<string, boolean>;
  };
  crafted: Record<string, number>;
  inv: Record<string, number>;
  log: (string | LogItem)[];
}

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}
