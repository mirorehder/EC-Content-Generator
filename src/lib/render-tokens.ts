import { randomBytes } from "node:crypto";

// Kurzlebige Tokens, mit denen Remotions Headless-Chrome die Clip-Proxy-
// Route (/api/clips/[clipId]/media) aufrufen darf — es hat keine Session-
// Cookies. globalThis, damit Server Action und Route trotz getrennter
// Dev-Bundles denselben Store im Prozess sehen.
const TOKEN_TTL_MS = 3 * 60 * 60 * 1000;

interface TokenEntry {
  driveAccessToken: string;
  expiresAt: number;
}

const globalStore = globalThis as unknown as { __renderTokens?: Map<string, TokenEntry> };

function getStore(): Map<string, TokenEntry> {
  globalStore.__renderTokens ??= new Map();
  return globalStore.__renderTokens;
}

export function createRenderToken(driveAccessToken: string): string {
  const store = getStore();
  for (const [token, entry] of store) {
    if (entry.expiresAt < Date.now()) store.delete(token);
  }

  const token = randomBytes(32).toString("hex");
  store.set(token, { driveAccessToken, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

export function resolveRenderToken(token: string): string | null {
  const entry = getStore().get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.driveAccessToken;
}
