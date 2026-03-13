import { describe, expect, it } from "vitest";
import { buildRequestBody, buildUrlParams, encodeRPCRequest } from "../../../src/rpc/encoder.js";
import { RPCMethod } from "../../../src/types/enums.js";

describe("encodeRPCRequest", () => {
  it("produces triple-nested array structure", () => {
    const result = encodeRPCRequest(RPCMethod.LIST_NOTEBOOKS, [null, 1]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
    const inner = result[0]![0]!;
    expect(inner[0]).toBe(RPCMethod.LIST_NOTEBOOKS);
    expect(inner[1]).toBe(JSON.stringify([null, 1]));
    expect(inner[2]).toBeNull();
    expect(inner[3]).toBe("generic");
  });
});

describe("buildRequestBody", () => {
  it("includes f.req and at fields with trailing &", () => {
    const req = encodeRPCRequest(RPCMethod.LIST_NOTEBOOKS, [null]);
    const body = buildRequestBody(req, "csrf_token_123");
    expect(body).toContain("f.req=");
    expect(body).toContain("at=");
    expect(body.endsWith("&")).toBe(true);
  });

  it("URL-encodes special characters", () => {
    const req = [[[RPCMethod.LIST_NOTEBOOKS, '["a","b"]', null, "generic"]]];
    const body = buildRequestBody(req, "AF1_QpN-abc+def");
    expect(body).toContain("at=AF1_QpN-abc%2Bdef");
  });
});

describe("buildUrlParams", () => {
  it("includes required params", () => {
    const params = buildUrlParams(RPCMethod.LIST_NOTEBOOKS, "session123");
    expect(params.get("rpcids")).toBe(RPCMethod.LIST_NOTEBOOKS);
    expect(params.get("f.sid")).toBe("session123");
    expect(params.get("rt")).toBe("c");
  });

  it("uses provided source-path", () => {
    const params = buildUrlParams(RPCMethod.GET_NOTEBOOK, "sid", "/notebook/abc");
    expect(params.get("source-path")).toBe("/notebook/abc");
  });
});
