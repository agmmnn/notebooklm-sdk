import {
  AuthError,
  ClientError,
  NetworkError,
  RPCError,
  RPCTimeoutError,
  RateLimitError,
  ServerError,
} from "../types/errors.js";
import type { RPCMethodId } from "../types/enums.js";
import type { AuthTokens } from "../auth.js";
import { buildRequestBody, buildUrlParams, encodeRPCRequest } from "./encoder.js";
import { decodeResponse } from "./decoder.js";

const BATCHEXECUTE_URL = "https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface RPCCallOptions {
  sourcePath?: string;
  allowNull?: boolean;
  timeoutMs?: number;
}

export class RPCCore {
  private readonly auth: AuthTokens;
  private readonly timeoutMs: number;

  constructor(auth: AuthTokens, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.auth = auth;
    this.timeoutMs = timeoutMs;
  }

  async call(
    methodId: RPCMethodId,
    params: unknown[],
    opts: RPCCallOptions = {},
  ): Promise<unknown> {
    const sourcePath = opts.sourcePath ?? "/";
    const allowNull = opts.allowNull ?? false;
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;

    const rpcRequest = encodeRPCRequest(methodId, params);
    const body = buildRequestBody(rpcRequest, this.auth.csrfToken);
    const urlParams = buildUrlParams(methodId, this.auth.sessionId, sourcePath);
    const url = `${BATCHEXECUTE_URL}?${urlParams.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Cookie: this.auth.cookieHeader,
        },
        body,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof Error && e.name === "AbortError") {
        throw new RPCTimeoutError(`Request timed out calling ${methodId}`, {
          methodId,
          originalError: e,
        });
      }
      throw new NetworkError(`Request failed calling ${methodId}: ${String(e)}`, {
        methodId,
        originalError: e instanceof Error ? e : undefined,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        throw new RateLimitError(`API rate limit exceeded calling ${methodId}`, {
          methodId,
          retryAfter: isNaN(retryAfter ?? NaN) ? undefined : retryAfter,
        });
      }
      if (status === 401 || status === 403) {
        throw new AuthError(`HTTP ${status} calling ${methodId}: authentication required`, {
          methodId,
        });
      }
      if (status >= 500) {
        throw new ServerError(`Server error ${status} calling ${methodId}`, {
          methodId,
          statusCode: status,
        });
      }
      if (status >= 400) {
        throw new ClientError(`Client error ${status} calling ${methodId}`, {
          methodId,
          statusCode: status,
        });
      }
      throw new RPCError(`HTTP ${status} calling ${methodId}`, { methodId });
    }

    const text = await response.text();
    return decodeResponse(text, methodId, allowNull);
  }

  /** Extract source IDs from a notebook (used by chat/artifact APIs). */
  async getSourceIds(notebookId: string): Promise<string[]> {
    const params = [notebookId, null, [2], null, 0];
    // Inline import to avoid circular — use same methodId constant
    const { RPCMethod } = await import("../types/enums.js");
    const data = await this.call(RPCMethod.GET_NOTEBOOK, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    const sourceIds: string[] = [];
    if (!Array.isArray(data) || !data.length) return sourceIds;

    try {
      const nbInfo = data[0] as unknown[];
      if (!Array.isArray(nbInfo) || nbInfo.length <= 1) return sourceIds;
      const sources = nbInfo[1] as unknown[];
      if (!Array.isArray(sources)) return sourceIds;
      for (const src of sources) {
        if (!Array.isArray(src) || !src.length) continue;
        const first = src[0];
        if (Array.isArray(first) && first.length > 0 && typeof first[0] === "string") {
          sourceIds.push(first[0] as string);
        }
      }
    } catch {
      // ignore parse errors
    }
    return sourceIds;
  }
}
