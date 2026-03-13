import { describe, expect, it } from "vitest";
import {
  collectRPCIds,
  decodeResponse,
  extractRPCResult,
  parseChunkedResponse,
  stripAntiXSSI,
} from "../../../src/rpc/decoder.js";
import { RateLimitError, RPCError } from "../../../src/types/errors.js";

describe("stripAntiXSSI", () => {
  it("removes )]}' prefix with Unix newline", () => {
    const input = ')]}\'\n{"key":"value"}';
    expect(stripAntiXSSI(input)).toBe('{"key":"value"}');
  });

  it("removes )]}' prefix with Windows newline", () => {
    const input = ')]}\'\r\n{"key":"value"}';
    expect(stripAntiXSSI(input)).toBe('{"key":"value"}');
  });

  it("returns unchanged string without prefix", () => {
    const input = '{"key":"value"}';
    expect(stripAntiXSSI(input)).toBe(input);
  });
});

describe("parseChunkedResponse", () => {
  it("parses byte_count + JSON format", () => {
    const chunkData = [["wrb.fr", "wXbhsf", "[]", null, null]];
    const json = JSON.stringify(chunkData);
    const input = `${json.length}\n${json}`;
    const result = parseChunkedResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(chunkData);
  });

  it("returns empty array for empty input", () => {
    expect(parseChunkedResponse("")).toEqual([]);
    expect(parseChunkedResponse("   ")).toEqual([]);
  });

  it("handles multiple chunks", () => {
    const chunk1 = [["noop"]];
    const chunk2 = [["wrb.fr", "abc123", null]];
    const j1 = JSON.stringify(chunk1);
    const j2 = JSON.stringify(chunk2);
    const input = `${j1.length}\n${j1}\n${j2.length}\n${j2}`;
    const result = parseChunkedResponse(input);
    expect(result).toHaveLength(2);
  });
});

describe("collectRPCIds", () => {
  it("finds wrb.fr IDs", () => {
    const chunks = [[["wrb.fr", "wXbhsf", "[]", null, null]]];
    expect(collectRPCIds(chunks as unknown[][])).toEqual(["wXbhsf"]);
  });

  it("finds er IDs", () => {
    const chunks = [[["er", "tGMBJ", 404]]];
    expect(collectRPCIds(chunks as unknown[][])).toEqual(["tGMBJ"]);
  });
});

describe("extractRPCResult", () => {
  it("extracts result from wrb.fr entry", () => {
    const data = { notebooks: [] };
    const chunks = [[["wrb.fr", "wXbhsf", JSON.stringify(data)]]];
    const result = extractRPCResult(chunks as unknown[][], "wXbhsf");
    expect(result).toEqual(data);
  });

  it("throws RPCError on er entry", () => {
    const chunks = [[["er", "wXbhsf", 404]]];
    expect(() => extractRPCResult(chunks as unknown[][], "wXbhsf")).toThrow(RPCError);
  });

  it("throws RateLimitError on UserDisplayableError", () => {
    const chunks = [[["wrb.fr", "abc", null, null, null, ["UserDisplayableError"]]]];
    expect(() => extractRPCResult(chunks as unknown[][], "abc")).toThrow(RateLimitError);
  });

  it("returns null wrb.fr result as-is (without UserDisplayableError)", () => {
    const chunks = [[["wrb.fr", "abc", null]]];
    const result = extractRPCResult(chunks as unknown[][], "abc");
    expect(result).toBeNull();
  });
});

describe("decodeResponse", () => {
  it("full pipeline: strip + parse + extract", () => {
    const data = [[["notebook_title", null, "nb123"]]];
    const resultJson = JSON.stringify(data);
    const chunkData = [["wrb.fr", "wXbhsf", resultJson]];
    const chunkJson = JSON.stringify(chunkData);
    const raw = `)]}'\n${chunkJson.length}\n${chunkJson}`;
    const result = decodeResponse(raw, "wXbhsf");
    expect(result).toEqual(data);
  });

  it("throws RPCError when rpcId not found (allowNull=false)", () => {
    const chunkData = [["wrb.fr", "other_id", "{}"]];
    const chunkJson = JSON.stringify(chunkData);
    const raw = `)]}'\n${chunkJson.length}\n${chunkJson}`;
    expect(() => decodeResponse(raw, "missing_id")).toThrow(RPCError);
  });

  it("returns null when not found and allowNull=true", () => {
    const chunkData = [["noop"]];
    const chunkJson = JSON.stringify(chunkData);
    const raw = `)]}'\n${chunkJson.length}\n${chunkJson}`;
    const result = decodeResponse(raw, "missing_id", true);
    expect(result).toBeNull();
  });
});
