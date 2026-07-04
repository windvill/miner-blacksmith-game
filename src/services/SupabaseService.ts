import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { GameState, SupabaseConfig } from '../types/game';

const CLOUD_SAVE_TABLE = "game_saves";
let supabaseClient: SupabaseClient | null = null;
let currentUser: User | null = null;
let cloudSaveTimer: number | null = null;
let cloudSaveBusy = false;

declare global {
  interface Window {
    SUPABASE_CONFIG?: SupabaseConfig;
  }
}

export async function loadSupabaseConfig(): Promise<SupabaseConfig | null> {
  if (window.SUPABASE_CONFIG) return window.SUPABASE_CONFIG;
  if (location.protocol === "file:") return null;
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function initSupabase(
  onSessionChanged?: (user: User | null, shouldLoadCloud: boolean) => void,
  onStatusMessage?: (msg: string) => void
): Promise<SupabaseClient | null> {
  if (onStatusMessage) onStatusMessage("Supabase 연결 확인 중...");
  try {
    const config = await loadSupabaseConfig();
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
      if (onStatusMessage) onStatusMessage("Supabase 설정 대기 중");
      return null;
    }

    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });

    const { data } = await supabaseClient.auth.getSession();
    currentUser = data.session?.user || null;
    if (onSessionChanged) onSessionChanged(currentUser, false);

    supabaseClient.auth.onAuthStateChange((_event, session: Session | null) => {
      currentUser = session?.user || null;
      if (onSessionChanged) onSessionChanged(currentUser, true);
    });

    if (onStatusMessage) onStatusMessage("");
    return supabaseClient;
  } catch (error) {
    console.warn("Supabase init failed", error);
    if (onStatusMessage) onStatusMessage("Supabase 연결 실패");
    return null;
  }
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

export async function signInWithPassword(email: string, pass: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseClient) return { success: false, error: "Supabase 설정이 필요합니다." };
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
  if (error) return { success: false, error: error.message };
  currentUser = data.user;
  return { success: true };
}

export async function signUpWithPassword(email: string, pass: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseClient) return { success: false, error: "Supabase 설정이 필요합니다." };
  const { error } = await supabaseClient.auth.signUp({ email, password: pass });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signOut(): Promise<void> {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  currentUser = null;
}

export function scheduleCloudSave(getState: () => GameState, onStatus?: (msg: string) => void): void {
  if (!supabaseClient || !currentUser) return;
  if (cloudSaveTimer !== null) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => saveCloudNow(getState(), onStatus), 750);
}

export async function saveCloudNow(state: GameState, onStatus?: (msg: string) => void): Promise<boolean> {
  if (!supabaseClient || !currentUser || cloudSaveBusy) return false;
  cloudSaveBusy = true;
  if (onStatus) onStatus("클라우드 저장 중...");
  try {
    const { error } = await supabaseClient
      .from(CLOUD_SAVE_TABLE)
      .upsert({
        user_id: currentUser.id,
        state,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (error) {
      if (onStatus) onStatus("클라우드 저장 실패");
      return false;
    }
    if (onStatus) onStatus("클라우드 저장 완료");
    return true;
  } catch {
    if (onStatus) onStatus("클라우드 저장 오류");
    return false;
  } finally {
    cloudSaveBusy = false;
  }
}

export async function loadCloudSave(onLoadedState: (state: GameState) => void, onStatus?: (msg: string) => void): Promise<void> {
  if (!supabaseClient || !currentUser) return;
  if (onStatus) onStatus("클라우드 데이터 로딩 중...");

  const { data, error } = await supabaseClient
    .from(CLOUD_SAVE_TABLE)
    .select("state, updated_at")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    if (onStatus) onStatus("클라우드 데이터 로딩 실패");
    return;
  }

  if (data?.state) {
    onLoadedState(data.state as GameState);
    if (onStatus) onStatus("클라우드 세이브 연동 완료");
  } else {
    // 최초 세이브 생성
    if (onStatus) onStatus("새 클라우드 세이브 생성 중");
  }
}
