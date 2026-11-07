import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCookieHeader,
  fetchTokens,
  loadCookiesFromObject,
  loadCookiesFromString,
} from "../../src/auth.js";
import { AuthError } from "../../src/types/errors.js";

describe("loadCookiesFromString", () => {
  it("parses semicolon-separated cookies", () => {
    const result = loadCookiesFromString("SID=abc123; HSID=def456; SSID=ghi789");
    expect(result).toEqual({ SID: "abc123", HSID: "def456", SSID: "ghi789" });
  });

  it("handles cookies without spaces after semicolons", () => {
    const result = loadCookiesFromString("SID=abc;HSID=def");
    expect(result).toEqual({ SID: "abc", HSID: "def" });
  });
});

describe("loadCookiesFromObject", () => {
  it("extracts cookies from .google.com domain", () => {
    const storage = {
      cookies: [
        { name: "SID", value: "abc", domain: ".google.com" },
        { name: "HSID", value: "def", domain: ".google.com" },
      ],
    };
    const result = loadCookiesFromObject(storage);
    expect(result["SID"]).toBe("abc");
    expect(result["HSID"]).toBe("def");
  });

  it("prefers .google.com over regional domains", () => {
    const storage = {
      cookies: [
        { name: "SID", value: "regional_sid", domain: ".google.com.sg" },
        { name: "SID", value: "base_sid", domain: ".google.com" },
      ],
    };
    const result = loadCookiesFromObject(storage);
    expect(result["SID"]).toBe("base_sid");
  });

  it("accepts regional Google domains", () => {
    const storage = {
      cookies: [{ name: "SID", value: "sid_val", domain: ".google.co.uk" }],
    };
    const result = loadCookiesFromObject(storage);
    expect(result["SID"]).toBe("sid_val");
  });

  it("throws AuthError when SID is missing", () => {
    const storage = {
      cookies: [{ name: "HSID", value: "def", domain: ".google.com" }],
    };
    expect(() => loadCookiesFromObject(storage)).toThrow(AuthError);
  });

  it("ignores non-Google domains", () => {
    const storage = {
      cookies: [
        { name: "SID", value: "abc", domain: ".google.com" },
        { name: "evil", value: "xyz", domain: ".evil.com" },
      ],
    };
    const result = loadCookiesFromObject(storage);
    expect(result["evil"]).toBeUndefined();
  });

  it("keeps host-only cookies for notebook.google.com", () => {
    const storage = {
      cookies: [
        { name: "SID", value: "sid_val", domain: ".google.com" },
        { name: "OSID", value: "new_osid", domain: "notebook.google.com" },
        { name: "__Secure-OSID", value: "new_secure_osid", domain: "notebook.google.com" },
      ],
    };
    const result = loadCookiesFromObject(storage);
    expect(result["OSID"]).toBe("new_osid");
    expect(result["__Secure-OSID"]).toBe("new_secure_osid");
  });

  it("still accepts host-only cookies for the legacy notebooklm.google.com host", () => {
    const storage = {
      cookies: [
        { name: "SID", value: "sid_val", domain: ".google.com" },
        { name: "OSID", value: "legacy_osid", domain: "notebooklm.google.com" },
      ],
    };
    const result = loadCookiesFromObject(storage);
    expect(result["OSID"]).toBe("legacy_osid");
  });

  it("prefers notebook.google.com over the legacy host on name collisions", () => {
    const storageLegacyFirst = {
      cookies: [
        { name: "SID", value: "sid_val", domain: ".google.com" },
        { name: "OSID", value: "legacy_osid", domain: "notebooklm.google.com" },
        { name: "OSID", value: "new_osid", domain: "notebook.google.com" },
      ],
    };
    const storageNewFirst = {
      cookies: [
        { name: "SID", value: "sid_val", domain: ".google.com" },
        { name: "OSID", value: "new_osid", domain: "notebook.google.com" },
        { name: "OSID", value: "legacy_osid", domain: "notebooklm.google.com" },
      ],
    };
    expect(loadCookiesFromObject(storageLegacyFirst)["OSID"]).toBe("new_osid");
    expect(loadCookiesFromObject(storageNewFirst)["OSID"]).toBe("new_osid");
  });
});

describe("fetchTokens", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the current NotebookLM origin", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('"SNlM0e":"csrf-token","FdrFJe":"session-id"', { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTokens({ SID: "abc" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://notebook.google.com/",
      expect.objectContaining({
        headers: { Cookie: "SID=abc" },
        redirect: "follow",
      }),
    );
    expect(result).toEqual({ csrfToken: "csrf-token", sessionId: "session-id" });
  });
});

describe("buildCookieHeader", () => {
  it("joins cookies with semicolons", () => {
    const header = buildCookieHeader({ SID: "abc", HSID: "def" });
    expect(header).toContain("SID=abc");
    expect(header).toContain("HSID=def");
    expect(header).toContain(";");
  });
});
