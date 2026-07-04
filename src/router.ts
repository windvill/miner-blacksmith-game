import { loadSupabaseConfig } from './services/SupabaseService';
import { createClient } from '@supabase/supabase-js';

async function route(): Promise<void> {
  const isGuest = localStorage.getItem("minerBlacksmithGuest");

  try {
    const config = await loadSupabaseConfig();
    if (config?.supabaseUrl && config?.supabaseAnonKey) {
      const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        window.location.replace("game.html");
        return;
      }
    }
  } catch (e) {
    console.warn("Session check failed", e);
  }

  if (isGuest === "true") {
    window.location.replace("game.html");
  } else {
    window.location.replace("login.html");
  }
}

document.addEventListener("DOMContentLoaded", route);
