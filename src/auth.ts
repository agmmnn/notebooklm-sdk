import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AuthError } from "./types/errors.js";

/** Default session file written by `npx notebooklm-sdk login`. */
const DEFAULT_SESSION_FILE = join(homedir(), ".notebooklm", "session.json");

export interface CookieMap {
  [key: string]: string;
}

export interface AuthTokens {
  cookies: CookieMap;
  csrfToken: string;
  sessionId: string;
  cookieHeader: string;
  /** Cookie header containing only .google.com domain cookies — for media downloads */
  googleCookieHeader: string;
}

// ---------------------------------------------------------------------------
// Cookie loading
// ---------------------------------------------------------------------------

/** Load cookies from a Playwright storage_state.json file. */
export function loadCookiesFromFile(filePath: string): CookieMap {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new AuthError(`Session file not found: ${filePath}\nRun: npx notebooklm-sdk login`);
  }
  return extractCookiesFromStorageState(JSON.parse(raw));
}

/** Load cookies from a raw Playwright storage state object. */
export function loadCookiesFromObject(storageState: {
  cookies?: Array<{ name: string; value: string; domain: string }>;
}): CookieMap {
  return extractCookiesFromStorageState(storageState);
}

/** Build a cookie header containing only .google.com domain cookies (for media downloads). */
export function buildGoogleCookieHeader(storageState: {
  cookies?: Array<{ name: string; value: string; domain: string }>;
}): string {
  const map: CookieMap = {};
  for (const c of storageState.cookies ?? []) {
    if (c.domain === ".google.com" && c.name && c.value) {
      map[c.name] = map[c.name] ?? c.value;
    }
  }
  return buildCookieHeader(map);
}

/** Load cookies from a flat cookie map (already parsed). */
export function loadCookiesFromMap(map: CookieMap): CookieMap {
  return { ...map };
}

/** Load cookies from a "; "-separated cookie string (e.g. process.env.NOTEBOOKLM_COOKIES). */
export function loadCookiesFromString(cookieStr: string): CookieMap {
  const map: CookieMap = {};
  for (const part of cookieStr.split(/;\s*/)) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (name) map[name] = value;
    }
  }
  return map;
}

function extractCookiesFromStorageState(storageState: {
  cookies?: Array<{ name: string; value: string; domain: string }>;
}): CookieMap {
  const cookies: CookieMap = {};
  const domainTrack: Record<string, string> = {};

  for (const cookie of storageState.cookies ?? []) {
    const { domain, name, value } = cookie;
    if (!isAllowedDomain(domain) || !name) continue;

    const isSpecific = domain.includes("notebook");
    if (!(name in cookies) || isSpecific) {
      cookies[name] = value;
      domainTrack[name] = domain;
    }
  }

  if (!cookies["SID"]) {
    throw new AuthError(
      "Missing required cookie: SID. Session may be invalid or expired.\nRun: npx notebooklm-sdk login",
    );
  }
  return cookies;
}

function isAllowedDomain(domain: string): boolean {
  const d = domain.startsWith(".") ? domain.slice(1) : domain;
  return (
    d === "google.com" ||
    d.endsWith(".google.com") ||
    d.startsWith("google.") ||
    d.includes(".google.") ||
    d === "googleusercontent.com" ||
    d.endsWith(".googleusercontent.com")
  );
}

export function buildCookieHeader(cookies: CookieMap): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

// ---------------------------------------------------------------------------
// Token fetching
// ---------------------------------------------------------------------------

const NOTEBOOKLM_URL = "https://notebook.google.com/";

export async function fetchTokens(
  cookies: CookieMap,
): Promise<{ csrfToken: string; sessionId: string }> {
  const cookieHeader = buildCookieHeader(cookies);

  const response = await fetch(NOTEBOOKLM_URL, {
    headers: {
      Cookie: cookieHeader,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new AuthError(`Failed to fetch NotebookLM page: HTTP ${response.status}`);
  }

  const finalUrl = response.url;
  if (isGoogleAuthRedirect(finalUrl)) {
    throw new AuthError(`Redirected to login page: ${finalUrl}. Cookies may be expired.`);
  }

  const html = await response.text();
  const csrfToken = extractCsrfToken(html, finalUrl);
  const sessionId = extractSessionId(html, finalUrl);

  return { csrfToken, sessionId };
}

export async function refreshAuthTokens(auth: AuthTokens): Promise<AuthTokens> {
  const { csrfToken, sessionId } = await fetchTokens(auth.cookies);
  auth.csrfToken = csrfToken;
  auth.sessionId = sessionId;
  return auth;
}

function extractCsrfToken(html: string, finalUrl: string): string {
  const match = /"SNlM0e"\s*:\s*"([^"]+)"/.exec(html);
  if (!match?.[1]) {
    if (isGoogleAuthRedirect(finalUrl) || html.includes("accounts.google.com")) {
      throw new AuthError("Session expired or invalid.\nRun: npx notebooklm-sdk login");
    }
    throw new AuthError("CSRF token (SNlM0e) not found in NotebookLM page HTML.");
  }
  return match[1];
}

function extractSessionId(html: string, finalUrl: string): string {
  const match = /"FdrFJe"\s*:\s*"([^"]+)"/.exec(html);
  if (!match?.[1]) {
    if (isGoogleAuthRedirect(finalUrl) || html.includes("accounts.google.com")) {
      throw new AuthError("Session expired or invalid.\nRun: npx notebooklm-sdk login");
    }
    throw new AuthError("Session ID (FdrFJe) not found in NotebookLM page HTML.");
  }
  return match[1];
}

function isGoogleAuthRedirect(url: string): boolean {
  return url.includes("accounts.google.com") || url.includes("signin");
}

// ---------------------------------------------------------------------------
// Connect options
// ---------------------------------------------------------------------------

export interface ConnectOptions {
  /** "; "-separated cookie string (e.g. "SID=abc; HSID=xyz") */
  cookies?: string;
  /** Path to Playwright storage_state.json */
  cookiesFile?: string;
  /** Pre-parsed cookie map */
  cookiesObject?: CookieMap | { cookies?: Array<{ name: string; value: string; domain: string }> };
}

export async function connect(opts: ConnectOptions = {}): Promise<AuthTokens> {
  let cookieMap: CookieMap;
  let googleCookieHeader: string | null = null;

  if (opts.cookies) {
    cookieMap = loadCookiesFromString(opts.cookies);
  } else if (opts.cookiesFile) {
    cookieMap = loadCookiesFromFile(opts.cookiesFile);
  } else if (opts.cookiesObject) {
    if ("cookies" in opts.cookiesObject && Array.isArray(opts.cookiesObject.cookies)) {
      const storageState = opts.cookiesObject as {
        cookies: Array<{ name: string; value: string; domain: string }>;
      };
      cookieMap = loadCookiesFromObject(storageState);
      googleCookieHeader = buildGoogleCookieHeader(storageState);
    } else {
      cookieMap = loadCookiesFromMap(opts.cookiesObject as CookieMap);
    }
  } else {
    // Auto-discovery: ~/.notebooklm/session.json → ./storage_state.json → env var
    const envCookies = process.env["NOTEBOOKLM_COOKIES"];
    const envFile = process.env["NOTEBOOKLM_COOKIES_FILE"];
    if (envFile) {
      cookieMap = loadCookiesFromFile(envFile);
    } else if (existsSync(DEFAULT_SESSION_FILE)) {
      const raw = readFileSync(DEFAULT_SESSION_FILE, "utf-8");
      const storageState = JSON.parse(raw);
      cookieMap = loadCookiesFromObject(storageState);
      googleCookieHeader = buildGoogleCookieHeader(storageState);
    } else if (existsSync("storage_state.json")) {
      const raw = readFileSync("storage_state.json", "utf-8");
      const storageState = JSON.parse(raw);
      cookieMap = loadCookiesFromObject(storageState);
      googleCookieHeader = buildGoogleCookieHeader(storageState);
    } else if (envCookies) {
      cookieMap = loadCookiesFromString(envCookies);
    } else {
      throw new AuthError("No session found. Run: npx notebooklm-sdk login");
    }
  }

  const { csrfToken, sessionId } = await fetchTokens(cookieMap);
  const cookieHeader = buildCookieHeader(cookieMap);

  return {
    cookies: cookieMap,
    csrfToken,
    sessionId,
    cookieHeader,
    googleCookieHeader: googleCookieHeader ?? cookieHeader,
  };
}
