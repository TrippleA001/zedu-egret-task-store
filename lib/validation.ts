export function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

export function normalizeZeduId(s: string) {
  return s.trim().toLowerCase();
}

export function normalizeTelegram(s: string) {
  // Display name mode: free text as shown on the Telegram profile
  // (e.g. "A Data Scientist"). Collapse extra whitespace, keep case/spaces.
  return s.replace(/\s+/g, " ").trim().replace(/^@+/, "");
}

export function isValidTelegram(h: string) {
  const t = h.trim();
  return t.length >= 2 && t.length <= 100;
}

// Human-friendly error for display names.
export function telegramError(raw: string): string | null {
  const h = normalizeTelegram(raw);
  if (!h) return "Please enter your Telegram display name as shown on your profile (e.g. A Data Scientist).";
  if (h.length < 2)
    return "That display name looks too short. Enter your full Telegram display name as shown on your profile.";
  if (h.length > 100)
    return "That display name is longer than 100 characters. Enter a shorter form of your Telegram display name.";
  return null;
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

/** Parse a GitHub PR reference. Accepts full URL (…/owner/repo/pull/N) or
 *  short form (owner/repo#N). Anything else (including issue links) → null. */
export function parseGithubPr(input: string): { owner: string; repo: string; number: number } | null {
  const t = input.trim().replace(/\/+$/, "").replace(/\/(files|commits|checks)$/i, "");
  let m = t.match(/^https?:\/\/(www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)$/i);
  if (m) return { owner: m[2], repo: m[3], number: Number(m[4]) };
  m = t.match(/^([^/\s]+)\/([^/\s]+)#(\d+)$/);
  if (m && !m[1].includes(":") && !m[1].includes(".")) return { owner: m[1], repo: m[2], number: Number(m[3]) };
  return null;
}

/** Accept a shared Google Drive file/folder link. Returns the canonical
 *  drive host or null when the input is not a Drive link at all. */
export function parseDriveUrl(input: string): string | null {
  let host = "";
  try {
    host = new URL(input.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === "drive.google.com" || host === "docs.google.com") return host;
  return null;
}

export function sanitizeText(s: string, max = 255) {
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

// Profile fields a user may request changes to. Identity fields (emails,
// zedu_id) and sub_team (auto-assigned) are deliberately excluded.
export const CHANGEABLE_FIELDS = [
  "full_name",
  "github_url",
  "telegram_handle",
  "skill_rating",
] as const;
export type ChangeableField = (typeof CHANGEABLE_FIELDS)[number];

export function isChangeableField(f: string): f is ChangeableField {
  return (CHANGEABLE_FIELDS as readonly string[]).includes(f);
}

/** Validate a proposed new value for a changeable profile field.
 *  Returns an error string or null (valid). */
export function changeValueError(field: ChangeableField, raw: string): string | null {
  const v = raw.trim();
  if (!v) return "New value is required";
  switch (field) {
    case "full_name": {
      const s = sanitizeText(v);
      if (s.length < 2) return "Full name looks too short";
      return null;
    }
    case "github_url": {
      try {
        const u = new URL(v);
        if (u.protocol !== "https:" || u.hostname !== "github.com") throw new Error();
      } catch {
        return "GitHub URL must be https://github.com/username";
      }
      return null;
    }
    case "telegram_handle":
      return telegramError(v);
    case "skill_rating":
      return ["1", "2", "3", "4", "5"].includes(v) ? null : "Skill rating must be 1-5";
  }
}

export function generateOrderNumber() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `ZE-2026-${suffix}`;
}
