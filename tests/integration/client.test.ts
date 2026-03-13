import { describe, expect, it, beforeAll } from "vitest";
import { NotebookLMClient } from "../../src/index.js";

// Check for required environment variables
const cookieVar = process.env.NOTEBOOKLM_COOKIE || process.env.NOTEBOOKLM_COOKIES;
const hasCookie = !!cookieVar;

// Skip the entire test suite if NOTEBOOKLM_COOKIE is missing
describe.skipIf(!hasCookie)("Integration Tests (requires NOTEBOOKLM_COOKIE)", () => {
  let client: NotebookLMClient;

  beforeAll(async () => {
    let opts = {};
    if (cookieVar?.trim().startsWith("{")) {
       opts = { cookiesObject: JSON.parse(cookieVar) };
    } else {
       opts = { cookies: cookieVar || "" };
    }
    // We instantiate the client using the cookie from the environment
    client = await NotebookLMClient.connect(opts);
  });

  it("should be able to list notebooks", async () => {
    // This is a minimal integration test to ensure the client can connect and fetch notebooks
    const notebooks = await client.notebooks.list();
    expect(notebooks).toBeDefined();
    expect(Array.isArray(notebooks)).toBe(true);
  });
});

describe("Integration Test Scaffold Info", () => {
  it.skipIf(hasCookie)("Integration tests skipped because NOTEBOOKLM_COOKIE is not set", () => {
    // This dummy test runs only when the main suite is skipped, providing a clear
    // message in the test output about why the integration tests didn't run.
    expect(true).toBe(true);
  });
});
