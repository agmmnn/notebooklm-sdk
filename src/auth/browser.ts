import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type BrowserContext, chromium, type Page } from "playwright";
import { type CookieMap, loadCookiesFromObject } from "../auth.js";
import { NOTEBOOKLM_HOST, NOTEBOOKLM_LEGACY_HOST, NOTEBOOKLM_ORIGIN } from "../constants.js";

/** Default directory for storing NotebookLM session files (~/.notebooklm). */
export const DEFAULT_SESSION_DIR = join(homedir(), ".notebooklm");
/** Default session file path (~/.notebooklm/session.json). */
export const DEFAULT_SESSION_FILE = join(DEFAULT_SESSION_DIR, "session.json");

export interface LoginOptions {
  /**
   * Path to a directory for a persistent browser profile.
   * Defaults to ~/.notebooklm/.auth_profile.
   */
  persistFolder?: string;
  /**
   * Browser type to use. Default is "chromium".
   */
  browserType?: "chromium" | "msedge";
  /**
   * Whether to run the browser in headless mode. Default is false.
   * Headless login is usually blocked by Google, so this is mostly for testing or refreshes.
   */
  headless?: boolean;
}

const NOTEBOOKLM_URL = `${NOTEBOOKLM_ORIGIN}/`;
const GOOGLE_ACCOUNTS_URL = "https://accounts.google.com/";

export function hasCsrfToken(html: string): boolean {
  return /"SNlM0e"\s*:\s*"([^"]+)"/.test(html);
}

function isNotebookLmHost(hostname: string): boolean {
  return hostname === NOTEBOOKLM_HOST || hostname === NOTEBOOKLM_LEGACY_HOST;
}

async function isAuthenticatedNotebookLm(page: Page): Promise<boolean> {
  const currentUrl = page.url();
  try {
    const url = new URL(currentUrl);
    if (!isNotebookLmHost(url.hostname)) {
      return false;
    }
    if (url.pathname.includes("/login") || url.pathname.includes("/trynow")) {
      return false;
    }
    const hasSignInBtn = await page
      .locator(".landing-header-signin, a[href*='/login']")
      .first()
      .isVisible()
      .catch(() => false);
    if (hasSignInBtn) {
      return false;
    }
    const html = await page.content().catch(() => "");
    return hasCsrfToken(html);
  } catch {
    return false;
  }
}

/**
 * Log in to NotebookLM via a headful browser window.
 *
 * Flow:
 * 1. Opens browser to NotebookLM.
 * 2. If already logged in (via persistFolder with valid session), it proceeds.
 * 3. If signed out, guides user to Google account picker/sign in and waits until authenticated.
 * 4. Captures cookies and returns them.
 */
export async function login(opts: LoginOptions = {}): Promise<{
  cookies: CookieMap;
  storageState: any;
  cookieHeader: string;
}> {
  const {
    persistFolder = join(DEFAULT_SESSION_DIR, ".auth_profile"),
    headless = false,
    browserType = "chromium",
  } = opts;

  // Pre-flight: verify Playwright browser is installed
  try {
    chromium.executablePath();
  } catch {
    throw new Error("Playwright browser not found. Run: npx playwright install chromium");
  }

  // Ensure the session directory exists
  if (!existsSync(DEFAULT_SESSION_DIR)) {
    mkdirSync(DEFAULT_SESSION_DIR, { recursive: true });
  }

  const launchOptions = {
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  };

  const context: BrowserContext = await chromium.launchPersistentContext(persistFolder, {
    ...launchOptions,
    channel: browserType === "msedge" ? "msedge" : undefined,
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(NOTEBOOKLM_URL);

    // If not already authenticated, wait for the user to complete Google sign-in
    if (!(await isAuthenticatedNotebookLm(page))) {
      console.log("Please log in to Google in the browser window...");

      // Optional UX: click the landing page Sign-in link so the user lands on the account picker
      if (!page.url().includes("accounts.google.com")) {
        try {
          const signInButton = page.locator(".landing-header-signin, a[href*='/login']").first();
          if (await signInButton.isVisible({ timeout: 2000 })) {
            await signInButton.click().catch(() => {});
          }
        } catch {
          // Ignore if clicking fails; user can proceed manually in the browser window
        }
      }

      // Wait until the user completes login and reaches an authenticated NotebookLM page
      while (true) {
        await page.waitForURL(
          (url) => {
            return (
              isNotebookLmHost(url.hostname) &&
              !url.hostname.includes("accounts.google.com") &&
              !url.pathname.includes("/login") &&
              !url.pathname.includes("/trynow")
            );
          },
          { timeout: 0 },
        );

        await page.waitForLoadState("domcontentloaded").catch(() => {});
        const html = await page.content().catch(() => "");
        if (hasCsrfToken(html)) {
          break;
        }

        await page.waitForTimeout(1000);
        const retryHtml = await page.content().catch(() => "");
        if (hasCsrfToken(retryHtml)) {
          break;
        }

        await page.waitForTimeout(1000);
      }
    }

    // Ensure we are fully loaded on the accounts domain too to capture those cookies
    await page.goto(GOOGLE_ACCOUNTS_URL, { waitUntil: "load" });
    await page.goto(NOTEBOOKLM_URL, { waitUntil: "load" });
    await page.waitForLoadState("domcontentloaded").catch(() => {});

    // Verify authenticated state before saving session
    const finalHtml = await page.content();
    if (!hasCsrfToken(finalHtml)) {
      throw new Error(
        "Login failed: signed-out landing / login not completed. CSRF token (SNlM0e) not found in NotebookLM page HTML.",
      );
    }

    const storageState = await context.storageState();
    const cookies = loadCookiesFromObject(storageState as any);

    return {
      cookies,
      storageState,
      cookieHeader: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    };
  } finally {
    await context.close().catch(() => {});
  }
}
