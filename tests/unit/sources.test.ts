import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourcesAPI } from "../../src/api/sources.js";
import { RPCCore } from "../../src/rpc/core.js";

function getFixture(filename: string): string {
  return fs.readFileSync(path.join(__dirname, `../fixtures/responses/${filename}`), "utf-8");
}

describe("SourcesAPI", () => {
  let api: SourcesAPI;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    const auth = {
      sessionId: "mock-session",
      csrfToken: "mock-csrf",
      cookieHeader: "mock-cookie",
      googleCookieHeader: "mock-cookie",
      cookies: {},
    };
    const realCore = new RPCCore(auth);
    api = new SourcesAPI(realCore, auth);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchWithFixture(fixtureName: string, status: number = 200) {
    const fixture = getFixture(`${fixtureName}.txt`);
    vi.mocked(fetch).mockImplementation(async () => new Response(fixture, { status }));
  }

  it("list() returns sources", async () => {
    mockFetchWithFixture("real_api_list_sources");
    const result = await api.list("nb-id");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("title");
  });

  it("get() returns a specific source", async () => {
    mockFetchWithFixture("real_api_list_sources");
    const result = await api.list("nb-id");
    const firstSourceId = result[0].id;

    // get() just calls list() internally, so we don't need a different fixture
    const src = await api.get("nb-id", firstSourceId);
    expect(src).toBeDefined();
    expect(src?.id).toBe(firstSourceId);
  });

  it("addUrl() adds a URL source", async () => {
    mockFetchWithFixture("sources_add_url");
    const src = await api.addUrl("nb-id", "https://example.com");
    expect(src).toHaveProperty("id");
  });

  it("addText() adds a text source", async () => {
    mockFetchWithFixture("sources_add_text");
    const src = await api.addText("nb-id", "Some test content", "My text source");
    expect(src).toHaveProperty("id");
  });

    it("addFile() uploads a file", async () => {
    // When addFileBuffer is called, it makes 3 calls:
    // 1) batchexecute ADD_SOURCE_FILE
    // 2) fetch POST to UPLOAD_URL to init
    // 3) fetch POST to stream bits
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(async (_url) => {
      callCount++;
      if (callCount === 1) {
        // batchexecute ADD_SOURCE_FILE intent
        const fixture = getFixture(`sources_add_file_1.txt`);
        return new Response(fixture, { status: 200 });
      }
      if (callCount === 2) {
        // init upload
        return new Response("ok", {
          status: 200,
          headers: new Headers({ "x-goog-upload-url": "http://mock-upload" }),
        });
      }
      // upload data
      return new Response("http://mock-file-url", { status: 200 });
    });

    const buf = Buffer.from("hello world");
    const src = await api.addFileBuffer("nb-id", buf, "test.txt", "text/plain");
    expect(src).toHaveProperty("id");
  });

  it("delete() succeeds", async () => {
    mockFetchWithFixture("sources_delete");
    await expect(api.delete("nb-id", "src-id")).resolves.toBe(true);
  });

  it("refresh() completes successfully", async () => {
    mockFetchWithFixture("sources_refresh");
    await expect(api.refresh("nb-id", "src-id")).resolves.toBe(true);
  });
});
