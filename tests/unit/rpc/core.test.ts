import { describe, expect, it, vi } from "vitest";
import { RPCCore } from "../../../src/rpc/core.js";
import { RPCMethod } from "../../../src/types/enums.js";

describe("RPCCore auth retry", () => {
  it("refreshes auth once and retries on 401", async () => {
    const auth = {
      sessionId: "old-session",
      csrfToken: "old-csrf",
      cookieHeader: "mock-cookie",
      googleCookieHeader: "mock-cookie",
      cookies: {},
    };

    const refreshAuth = vi.fn().mockImplementation(async () => {
      auth.sessionId = "new-session";
      auth.csrfToken = "new-csrf";
    });

    const successBody = ')]}\'\n32\n[["wrb.fr","wXbhsf","[[\\"ok\\"]]"]]';
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
        .mockResolvedValueOnce(new Response(successBody, { status: 200 })),
    );

    const rpc = new RPCCore(auth, 30_000, refreshAuth);
    const result = await rpc.call(RPCMethod.LIST_NOTEBOOKS, [null, 1, null, [2]]);

    expect(refreshAuth).toHaveBeenCalledTimes(1);
    expect(result).toEqual([["ok"]]);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      "https://notebook.google.com/_/LabsTailwindUi/data/batchexecute",
    );
    vi.unstubAllGlobals();
  });
});
