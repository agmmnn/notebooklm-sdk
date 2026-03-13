import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotebooksAPI } from "../../src/api/notebooks.js";
import { RPCCore } from "../../src/rpc/core.js";

function getFixture(filename: string): string {
  return fs.readFileSync(path.join(__dirname, `../fixtures/responses/${filename}`), "utf-8");
}

describe("NotebooksAPI", () => {
  let api: NotebooksAPI;

  beforeEach(() => {
    // We can either mock RPCCore, or mock fetch.
    // Mocking fetch is better to test RPCCore parsing logic simultaneously.
    globalThis.fetch = vi.fn();
    const auth = {
      sessionId: "mock-session",
      csrfToken: "mock-csrf",
      cookieHeader: "mock-cookie",
      cookies: {},
    };
    const realCore = new RPCCore(auth);
    api = new NotebooksAPI(realCore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchWithFixture(fixtureName: string, status: number = 200) {
    const fixture = getFixture(`${fixtureName}.txt`);
    vi.mocked(fetch).mockImplementation(async () => new Response(fixture, { status }));
  }

  it("list() returns notebooks", async () => {
    mockFetchWithFixture("notebooks_list");
    const result = await api.list();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("title");
  });

  it("create() returns a new notebook ID", async () => {
    mockFetchWithFixture("notebooks_create");
    const nb = await api.create("Test Notebook");
    expect(nb.id).toBeTypeOf("string");
    expect(nb.id.length).toBeGreaterThan(0);
  });

  it("get() returns a specific notebook with its sources", async () => {
    mockFetchWithFixture("notebooks_get");
    const nb = await api.get("test-id");
    expect(nb.id).toBeTypeOf("string");
    expect(nb.title).toBeDefined();
  });

  it("delete() succeeds", async () => {
    mockFetchWithFixture("notebooks_delete");
    await expect(api.delete("test-id")).resolves.toBe(true);
  });

  it("rename() succeeds", async () => {
    // rename mock might need the get response inside, but if we use notebooks_rename fixture
    // it will return rename data for both rename and get. The get step might fail to parse correctly
    // if the formats are different, but we'll see if it throws.
    mockFetchWithFixture("notebooks_rename");
    const nb = await api.rename("test-id", "New Title");
    expect(nb).toBeDefined();
  });

  it("getSummary() returns text output", async () => {
    mockFetchWithFixture("notebooks_get_summary");
    const summary = await api.getSummary("test-id");
    expect(summary).toBeTypeOf("string");
  });

  it("getDescription() returns description with suggested topics", async () => {
    mockFetchWithFixture("notebooks_get_summary");
    const desc = await api.getDescription("test-id");
    expect(desc).toHaveProperty("summary");
    expect(desc).toHaveProperty("suggestedTopics");
  });
});
