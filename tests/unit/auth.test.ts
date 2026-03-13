import { describe, expect, it } from "vitest";
import { buildCookieHeader, loadCookiesFromObject, loadCookiesFromString } from "../../src/auth.js";
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
});

describe("buildCookieHeader", () => {
  it("joins cookies with semicolons", () => {
    const header = buildCookieHeader({ SID: "abc", HSID: "def" });
    expect(header).toContain("SID=abc");
    expect(header).toContain("HSID=def");
    expect(header).toContain(";");
  });
});
