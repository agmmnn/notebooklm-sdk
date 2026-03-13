import { type BrowserContext, chromium, type Page } from "playwright";
import { type CookieMap, loadCookiesFromObject } from "../auth.js";

export interface LoginOptions {
  /**
   * Path to a directory for a persistent browser profile.
   * If provided, session remains logged in for future calls.
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

const NOTEBOOKLM_URL = "https://notebooklm.google.com/";
const GOOGLE_ACCOUNTS_URL = "https://accounts.google.com/";

/**
 * Log in to NotebookLM via a headful browser window.
 *
 * Flow:
 * 1. Opens browser to NotebookLM.
 * 2. If already logged in (via persistFolder), it proceeds.
 * 3. If not, it waits for the user to reach the home page.
 * 4. Captures cookies and returns them.
 */
export async function login(opts: LoginOptions = {}): Promise<{
  cookies: CookieMap;
  storageState: any;
  cookieHeader: string;
}> {
  const { persistFolder, headless = false, browserType = "chromium" } = opts;

  let context: BrowserContext;

  const launchOptions = {
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  };

  if (persistFolder) {
    context = await chromium.launchPersistentContext(persistFolder, {
      ...launchOptions,
      channel: browserType === "msedge" ? "msedge" : undefined,
    });
  } else {
    const browser = await chromium.launch({
      ...launchOptions,
      channel: browserType === "msedge" ? "msedge" : undefined,
    });
    context = await browser.newContext();
  }

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(NOTEBOOKLM_URL);

  // Check if we are on the login page
  if (page.url().includes("accounts.google.com")) {
    console.log("Please log in to Google in the browser window...");

    // Wait for navigation back to NotebookLM or successful login indicator
    // We poll until the URL includes notebooklm.google.com and it's not a generic landing page
    await page.waitForURL(
      (url) => {
        return url.hostname === "notebooklm.google.com" && !url.pathname.includes("/login");
      },
      { timeout: 0 },
    ); // No timeout, wait for user
  }

  // Ensure we are fully loaded on the accounts domain too to capture those cookies
  await page.goto(GOOGLE_ACCOUNTS_URL, { waitUntil: "load" });
  await page.goto(NOTEBOOKLM_URL, { waitUntil: "load" });

  const storageState = await context.storageState();
  const cookies = loadCookiesFromObject(storageState as any);

  await context.close();

  return {
    cookies,
    storageState,
    cookieHeader: Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; "),
  };
}
