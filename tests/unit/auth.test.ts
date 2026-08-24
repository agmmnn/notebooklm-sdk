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

  it("prefers notebook.google.com over .google.com", () => {
    const storage = {
      cookies: [
        { name: "OSID", value: "base_osid", domain: ".google.com" },
        { name: "OSID", value: "notebook_osid", domain: "notebook.google.com" },
        { name: "SID", value: "base_sid", domain: ".google.com" },
      ],
    };
    const result = loadCookiesFromObject(storage);
    expect(result["OSID"]).toBe("notebook_osid");
    expect(result["SID"]).toBe("base_sid");
  });

  it("throws AuthError when SID is missing", () => {
    const storage = {
      cookies: [{ name: "HSID", value: "def", domain: ".google.com" }],
    };
    expect(() => loadCookiesFromObject(storage)).toThrow(AuthError);
  });

  it("ignores non-matching domains", () => {
    const storage = {
      cookies: [
        { name: "SID", value: "abc", domain: ".google.com" },
        { name: "evil", value: "xyz", domain: ".evil.com" },
        { name: "other_osid", value: "123", domain: "myaccount.google.com" },
        { name: "old_osid", value: "456", domain: "notebooklm.google.com" },
      ],
    };
    const result = loadCookiesFromObject(storage);
    expect(result["evil"]).toBeUndefined();
    expect(result["other_osid"]).toBeUndefined();
    expect(result["old_osid"]).toBeUndefined();
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
