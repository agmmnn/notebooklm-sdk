import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasCsrfToken, login } from "../../src/auth/browser.js";
import { NOTEBOOKLM_ORIGIN } from "../../src/constants.js";

vi.mock("playwright", () => ({
  chromium: {
    executablePath: vi.fn().mockReturnValue("/mock/path/chromium"),
    launchPersistentContext: vi.fn(),
  },
}));

describe("hasCsrfToken", () => {
  it("detects SNlM0e in HTML string", () => {
    expect(
      hasCsrfToken(
        '<script nonce="xyz">window.WIZ_global_data = {"SNlM0e":"valid-csrf"};</script>',
      ),
    ).toBe(true);
    expect(hasCsrfToken('"SNlM0e" : "token-with-spaces"')).toBe(true);
  });

  it("returns false when SNlM0e is missing", () => {
    expect(hasCsrfToken("<html><body>Sign in to Gemini Notebook</body></html>")).toBe(false);
    expect(hasCsrfToken('{"FdrFJe":"session-only","WIZ_global_data":{}}')).toBe(false);
  });
});

describe("login", () => {
  let mockPage: any;
  let mockContext: any;

  beforeEach(() => {
    mockPage = {
      url: vi.fn().mockReturnValue(`${NOTEBOOKLM_ORIGIN}/`),
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue('<script>"SNlM0e":"test-token"</script>'),
      locator: vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
          click: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      waitForURL: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      pages: vi.fn().mockReturnValue([mockPage]),
      newPage: vi.fn().mockResolvedValue(mockPage),
      storageState: vi.fn().mockResolvedValue({
        cookies: [{ name: "SID", value: "test-sid", domain: ".google.com" }],
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proceeds directly when already authenticated with SNlM0e present", async () => {
    const { chromium } = await import("playwright");
    vi.mocked(chromium.launchPersistentContext).mockResolvedValue(mockContext);

    const result = await login();

    expect(mockPage.goto).toHaveBeenCalledWith(`${NOTEBOOKLM_ORIGIN}/`);
    expect(result.cookies.SID).toBe("test-sid");
    expect(mockContext.close).toHaveBeenCalled();
  });

  it("throws clear error when final page still lacks SNlM0e after flow", async () => {
    const { chromium } = await import("playwright");
    // Sequence of page.content calls:
    // 1. Initial check (isAuthenticatedNotebookLm) -> false (no token)
    // 2. In wait loop -> true (user logged in, token found) -> loop breaks
    // 3. Final check after accounts revisit -> false (token lost/invalid) -> throws
    mockPage.content
      .mockResolvedValueOnce("<html><body>Unauthenticated landing</body></html>")
      .mockResolvedValueOnce('<script>"SNlM0e":"valid-token"</script>')
      .mockResolvedValueOnce("<html><body>Missing token after revisit</body></html>");

    mockPage.locator.mockReturnValue({
      first: vi.fn().mockReturnValue({
        isVisible: vi.fn().mockResolvedValue(true),
        click: vi.fn().mockResolvedValue(undefined),
      }),
    });

    vi.mocked(chromium.launchPersistentContext).mockResolvedValue(mockContext);

    await expect(login()).rejects.toThrow(/signed-out landing \/ login not completed/);
    expect(mockContext.close).toHaveBeenCalled();
  });
});
