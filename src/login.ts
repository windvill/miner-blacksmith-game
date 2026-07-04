import { initSupabase, signInWithPassword, signUpWithPassword } from './services/SupabaseService';

const $ = (id: string) => document.getElementById(id) as HTMLElement | null;

function toast(text: string): void {
  const toastEl = $("toast");
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout((toast as unknown as { timer: number }).timer);
  (toast as unknown as { timer: number }).timer = window.setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function setStatus(msg: string): void {
  const statusEl = $("statusMsg");
  if (statusEl) statusEl.textContent = msg;
}

async function handleLogin(): Promise<void> {
  const emailInput = $("authEmail") as HTMLInputElement | null;
  const passwordInput = $("authPassword") as HTMLInputElement | null;
  const email = emailInput?.value.trim() || "";
  const password = passwordInput?.value || "";

  if (!email || !password) {
    toast("이메일과 비밀번호를 입력해주세요.");
    return;
  }

  setStatus("로그인 중...");
  const result = await signInWithPassword(email, password);
  if (!result.success) {
    toast(result.error || "로그인 실패");
    setStatus("로그인 실패");
  } else {
    toast("로그인 성공!");
    setStatus("게임 페이지로 이동합니다...");
    setTimeout(() => {
      window.location.href = "game.html";
    }, 500);
  }
}

async function handleSignUp(): Promise<void> {
  const emailInput = $("authEmail") as HTMLInputElement | null;
  const passwordInput = $("authPassword") as HTMLInputElement | null;
  const email = emailInput?.value.trim() || "";
  const password = passwordInput?.value || "";

  if (!email || !password) {
    toast("이메일과 비밀번호를 입력해주세요.");
    return;
  }

  setStatus("회원가입 진행 중...");
  const result = await signUpWithPassword(email, password);
  if (!result.success) {
    toast(result.error || "회원가입 실패");
    setStatus("회원가입 실패");
  } else {
    toast("회원가입 완료! (이메일 확인이 필요할 수 있습니다)");
    setStatus("회원가입 완료.");
  }
}

function startGuest(): void {
  localStorage.setItem("minerBlacksmithGuest", "true");
  toast("게스트 모드로 시작합니다!");
  setTimeout(() => {
    window.location.href = "game.html";
  }, 300);
}

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = $("loginBtn");
  const signupBtn = $("signupBtn");
  const guestBtn = $("guestBtn");

  if (loginBtn) loginBtn.addEventListener("click", handleLogin);
  if (signupBtn) signupBtn.addEventListener("click", handleSignUp);
  if (guestBtn) guestBtn.addEventListener("click", startGuest);

  initSupabase(
    (user) => {
      if (user) {
        setStatus("로그인 세션 확인됨. 게임으로 이동합니다...");
        setTimeout(() => {
          window.location.href = "game.html";
        }, 600);
      }
    },
    (statusMsg) => {
      if (statusMsg) setStatus(statusMsg);
    }
  );
});
