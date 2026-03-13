import type { RPCMethodId } from "../types/enums.js";

/**
 * Encode RPC params into batchexecute triple-nested format.
 * Result: [[[rpcId, JSON.stringify(params), null, "generic"]]]
 */
export function encodeRPCRequest(methodId: RPCMethodId, params: unknown[]): unknown[][][] {
  const paramsJson = JSON.stringify(params);
  return [[[methodId, paramsJson, null, "generic"]]];
}

/**
 * Build URL-encoded request body for batchexecute.
 * Format: f.req=<encoded>&at=<csrf>&
 */
export function buildRequestBody(
  rpcRequest: unknown,
  csrfToken: string,
): string {
  const fReq = encodeURIComponent(JSON.stringify(rpcRequest));
  const at = encodeURIComponent(csrfToken);
  return `f.req=${fReq}&at=${at}&`;
}

/**
 * Build URL query params for a batchexecute call.
 */
export function buildUrlParams(
  methodId: RPCMethodId,
  sessionId: string,
  sourcePath = "/",
): URLSearchParams {
  return new URLSearchParams({
    rpcids: methodId,
    "source-path": sourcePath,
    "f.sid": sessionId,
    hl: "en",
    rt: "c",
  });
}
