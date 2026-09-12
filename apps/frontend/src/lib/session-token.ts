// The signed session token lives in sessionStorage (readable by our own JS, unlike the
// httpOnly cookie used for page-gating) purely so apiClient can attach it as x-session-token
// on backend calls that need a verified caller (e.g. the Users admin endpoints).
const STORAGE_KEY = "audix_session_token";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setSessionToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearSessionToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}
