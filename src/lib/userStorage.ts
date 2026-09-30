export function userStorageKey(userId: string, resource: string): string {
  if (!userId) throw new Error('Vui lòng đăng nhập để quản lý dữ liệu cá nhân.');
  return `vietnam:${encodeURIComponent(userId)}:${resource}`;
}
export function readUserData<T>(userId: string, resource: string, fallback: T): T {
  if (!userId) return fallback;
  try {
    const raw = localStorage.getItem(userStorageKey(userId, resource));
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}
export function writeUserData(userId: string, resource: string, value: unknown): void {
  localStorage.setItem(userStorageKey(userId, resource), JSON.stringify(value));
}
