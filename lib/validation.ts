export function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

export function normalizeZeduId(s: string) {
  return s.trim().toLowerCase();
}

export function normalizeTelegram(s: string) {
  return s.trim().replace(/^@+/, "");
}

export function isValidTelegram(h: string) {
  return /^[A-Za-z0-9_]{5,32}$/.test(h);
}

export function isHttpsUrl(u: string) {
  try {
    const x = new URL(u);
    return x.protocol === "https:";
  } catch {
    return false;
  }
}

export function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(127\.|10\.|192\.168\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "::1" || h === "[::1]") return true;
  return false;
}

export function parseGithubRepo(input: string): { owner: string; repo: string } | null {
  const t = input.trim().replace(/\/+$/, "");
  // Accept full URL https://github.com/owner/repo or owner/repo
  let m = t.match(/^https?:\/\/(www\.)?github\.com\/([^/\s]+)\/([^/\s]+?)(\.git)?$/i);
  if (m) return { owner: m[2], repo: m[3].replace(/\.git$/, "") };
  m = t.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (m && !m[1].includes(":") && !m[1].includes(".")) return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
  return null;
}

export function sanitizeText(s: string, max = 255) {
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

export function generateOrderNumber() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `ZE-2026-${suffix}`;
}
