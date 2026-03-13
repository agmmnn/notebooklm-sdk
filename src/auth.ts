import { readFileSync } from "node:fs";
import { AuthError } from "./types/errors.js";

export interface CookieMap {
  [key: string]: string;
}

export interface AuthTokens {
  cookies: CookieMap;
  csrfToken: string;
  sessionId: string;
  cookieHeader: string;
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
    throw new AuthError(
      `Cookie file not found: ${filePath}\n` + "Provide valid Playwright storage state JSON.",
    );
  }
  return extractCookiesFromStorageState(JSON.parse(raw));
}

/** Load cookies from a raw Playwright storage state object. */
export function loadCookiesFromObject(storageState: {
  cookies?: Array<{ name: string; value: string; domain: string }>;
}): CookieMap {
  return extractCookiesFromStorageState(storageState);
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

    const isBase = domain === ".google.com";
    if (!(name in cookies) || isBase) {
      cookies[name] = value;
      domainTrack[name] = domain;
    }
  }

  if (!cookies["SID"]) {
    throw new AuthError(
      "Missing required cookie: SID. " +
        "Provide valid Playwright storage state with Google cookies.",
    );
  }
  return cookies;
}

function isAllowedDomain(domain: string): boolean {
  if (
    domain === ".google.com" ||
    domain === "notebooklm.google.com" ||
    domain === ".googleusercontent.com"
  ) {
    return true;
  }
  if (domain.startsWith(".google.")) {
    return true; // Allow all regional Google domains
  }
  return false;
}

export function buildCookieHeader(cookies: CookieMap): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

// ---------------------------------------------------------------------------
// Token fetching
// ---------------------------------------------------------------------------

const NOTEBOOKLM_URL = "https://notebooklm.google.com/";

export async function fetchTokens(
  cookies: CookieMap,
): Promise<{ csrfToken: string; sessionId: string }> {
  const cookieHeader = buildCookieHeader(cookies);

  const response = await fetch(NOTEBOOKLM_URL, {
    headers: { Cookie: cookieHeader },
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

function extractCsrfToken(html: string, finalUrl: string): string {
  const match = /"SNlM0e"\s*:\s*"([^"]+)"/.exec(html);
  if (!match?.[1]) {
    if (isGoogleAuthRedirect(finalUrl) || html.includes("accounts.google.com")) {
      throw new AuthError("Authentication expired or invalid. Cookies may need to be refreshed.");
    }
    throw new AuthError("CSRF token (SNlM0e) not found in NotebookLM page HTML.");
  }
  return match[1];
}

function extractSessionId(html: string, finalUrl: string): string {
  const match = /"FdrFJe"\s*:\s*"([^"]+)"/.exec(html);
  if (!match?.[1]) {
    if (isGoogleAuthRedirect(finalUrl) || html.includes("accounts.google.com")) {
      throw new AuthError("Authentication expired or invalid. Cookies may need to be refreshed.");
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

export async function connect(opts: ConnectOptions): Promise<AuthTokens> {
  let cookieMap: CookieMap;

  if (opts.cookies) {
    cookieMap = loadCookiesFromString(opts.cookies);
  } else if (opts.cookiesFile) {
    cookieMap = loadCookiesFromFile(opts.cookiesFile);
  } else if (opts.cookiesObject) {
    if ("cookies" in opts.cookiesObject && Array.isArray(opts.cookiesObject.cookies)) {
      cookieMap = loadCookiesFromObject(
        opts.cookiesObject as { cookies: Array<{ name: string; value: string; domain: string }> },
      );
    } else {
      cookieMap = loadCookiesFromMap(opts.cookiesObject as CookieMap);
    }
  } else {
    // Fallback: check environment variable
    const envCookies = process.env["NOTEBOOKLM_COOKIES"];
    if (envCookies) {
      cookieMap = loadCookiesFromString(envCookies);
    } else {
      throw new AuthError(
        "No cookies provided. Pass cookies, cookiesFile, or cookiesObject to connect().",
      );
    }
  }

  const { csrfToken, sessionId } = await fetchTokens(cookieMap);

  return {
    cookies: cookieMap,
    csrfToken,
    sessionId,
    cookieHeader: buildCookieHeader(cookieMap),
  };
}
