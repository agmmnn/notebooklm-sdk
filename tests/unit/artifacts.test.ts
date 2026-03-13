import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { RPCCore } from "../../src/rpc/core.js";
import { ArtifactsAPI } from "../../src/api/artifacts.js";

function getFixture(filename: string): string {
  return fs.readFileSync(path.join(__dirname, `../fixtures/responses/${filename}`), "utf-8");
}

describe("ArtifactsAPI", () => {
  let api: ArtifactsAPI;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    const auth = {
      sessionId: "mock-session",
      csrfToken: "mock-csrf",
      cookieHeader: "mock-cookie",
      cookies: {},
    };
    const realCore = new RPCCore(auth);
    api = new ArtifactsAPI(realCore, auth);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchWithFixture(fixtureName: string, status: number = 200) {
    const fixture = getFixture(`${fixtureName}.txt`);
    vi.mocked(fetch).mockImplementation(async () => new Response(fixture, { status }));
  }

  it("list() returns artifacts", async () => {
    mockFetchWithFixture("artifacts_list_1");
    const result = await api.list("nb-id");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("id");
  });

  it("get() returns a specific artifact", async () => {
    mockFetchWithFixture("artifacts_list_1");
    const result = await api.list("nb-id");
    const firstId = result[0].id;

    // get() calls list() internally, so the same fixture works
    const art = await api.get("nb-id", firstId);
    expect(art).toBeDefined();
    expect(art?.id).toBe(firstId);
  });

  it("delete() succeeds", async () => {
    mockFetchWithFixture("artifacts_delete");
    await expect(api.delete("nb-id", "art-id")).resolves.toBe(true);
  });

  it("rename() succeeds", async () => {
    mockFetchWithFixture("artifacts_rename");
    await expect(api.rename("nb-id", "art-id", "New Title")).resolves.toBe(true);
  });

  // We explicitly provide sourceIds to avoid the internal getSourceIds call
  // which would require a multi-fetch mock setup for getNotebook -> createArtifact

  it("createQuiz() generates a quiz", async () => {
    mockFetchWithFixture("artifacts_generate_quiz");
    const result = await api.createQuiz("nb-id", { sourceIds: ["src-id"] });
    expect(result).toHaveProperty("artifactId");
    expect(result).toHaveProperty("status");
  });

  it("createFlashcards() generates flashcards", async () => {
    mockFetchWithFixture("artifacts_generate_flashcards");
    const result = await api.createFlashcards("nb-id", { sourceIds: ["src-id"] });
    expect(result).toHaveProperty("artifactId");
    expect(result).toHaveProperty("status");
  });

  it("createReport() generates a report", async () => {
    mockFetchWithFixture("artifacts_generate_report");
    const result = await api.createReport("nb-id", { sourceIds: ["src-id"] });
    expect(result).toHaveProperty("artifactId");
    expect(result).toHaveProperty("status");
  });

  it("createMindMap() generates a mind map", async () => {
    // We use a generate fixture since createMindMap just invokes CREATE_ARTIFACT
    mockFetchWithFixture("artifacts_generate_quiz");
    const result = await api.createMindMap("nb-id", ["src-id"]);
    expect(result).toHaveProperty("artifactId");
    expect(result).toHaveProperty("status");
  });
});
