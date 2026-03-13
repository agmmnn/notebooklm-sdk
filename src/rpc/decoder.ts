import { RateLimitError, RPCError } from "../types/errors.js";

/**
 * Strip Google's anti-XSSI prefix: )]}'\n
 */
export function stripAntiXSSI(response: string): string {
  if (response.startsWith(")]}'")) {
    const match = /\)\]\}'\r?\n/.exec(response);
    if (match) return response.slice(match[0].length);
  }
  return response;
}

/**
 * Parse chunked batchexecute response (rt=c mode).
 * Format: alternating byte_count lines and JSON payload lines.
 */
export function parseChunkedResponse(response: string): unknown[][] {
  if (!response || !response.trim()) return [];

  const chunks: unknown[][] = [];
  let skippedCount = 0;
  const lines = response.trim().split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = (lines[i] ?? "").trim();

    if (!line) {
      i++;
      continue;
    }

    // Try to parse as byte count (pure digits line)
    if (/^\d+$/.test(line)) {
      i++;
      if (i < lines.length) {
        try {
          const chunk = JSON.parse(lines[i] ?? "");
          chunks.push(chunk as unknown[][]);
        } catch {
          skippedCount++;
        }
      }
      i++;
    } else {
      // Try to parse directly as JSON
      try {
        const chunk = JSON.parse(line);
        chunks.push(chunk as unknown[][]);
      } catch {
        skippedCount++;
      }
      i++;
    }
  }

  if (skippedCount > 0 && lines.length > 0) {
    const errorRate = skippedCount / lines.length;
    if (errorRate > 0.1) {
      throw new RPCError(
        `Response parsing failed: ${skippedCount} of ${lines.length} chunks malformed`,
        { rawResponse: response.slice(0, 500) },
      );
    }
  }

  return chunks;
}

function containsUserDisplayableError(obj: unknown): boolean {
  if (typeof obj === "string") return obj.includes("UserDisplayableError");
  if (Array.isArray(obj)) return obj.some(containsUserDisplayableError);
  if (obj !== null && typeof obj === "object") {
    return Object.values(obj as Record<string, unknown>).some(containsUserDisplayableError);
  }
  return false;
}

/**
 * Collect all RPC IDs found in response chunks (for debugging).
 */
export function collectRPCIds(chunks: unknown[][]): string[] {
  const ids: string[] = [];
  for (const chunk of chunks) {
    if (!Array.isArray(chunk)) continue;
    const items: unknown[] = Array.isArray(chunk[0]) ? (chunk as unknown[][]) : [chunk];
    for (const item of items) {
      if (!Array.isArray(item) || item.length < 2) continue;
      if ((item[0] === "wrb.fr" || item[0] === "er") && typeof item[1] === "string") {
        ids.push(item[1] as string);
      }
    }
  }
  return ids;
}

/**
 * Extract the result for a specific RPC ID from parsed chunks.
 * Returns undefined if not found.
 */
export function extractRPCResult(chunks: unknown[][], rpcId: string): unknown {
  for (const chunk of chunks) {
    if (!Array.isArray(chunk)) continue;
    const items: unknown[][] = Array.isArray(chunk[0])
      ? (chunk as unknown[][])
      : [chunk as unknown[]];

    for (const item of items) {
      if (!Array.isArray(item) || item.length < 3) continue;

      if (item[0] === "er" && item[1] === rpcId) {
        const code = item[2] as string | number | undefined;
        let msg = "Unknown error";
        if (typeof code === "number") {
          if (code === 429) msg = "API rate limit exceeded. Please wait before retrying.";
          else if (code === 401 || code === 403) msg = "Authentication required or forbidden.";
          else if (code === 404) msg = "Resource not found.";
          else if (code >= 500) msg = `Server error ${code}. Try again later.`;
          else msg = `Error code: ${code}`;
        } else if (typeof code === "string") {
          msg = code;
        }
        throw new RPCError(msg, { methodId: rpcId, rpcCode: code });
      }

      if (item[0] === "wrb.fr" && item[1] === rpcId) {
        const resultData = item[2];

        // Check for UserDisplayableError (rate limit / quota)
        if (resultData === null && item.length > 5 && item[5] != null) {
          if (containsUserDisplayableError(item[5])) {
            throw new RateLimitError(
              "API rate limit or quota exceeded. Please wait before retrying.",
              { methodId: rpcId, rpcCode: "USER_DISPLAYABLE_ERROR" },
            );
          }
        }

        if (typeof resultData === "string") {
          try {
            return JSON.parse(resultData);
          } catch {
            return resultData;
          }
        }
        if (resultData === null) {
          console.log(
            "decodeResponse debug info: resultData is exactly null. Full item Array:",
            JSON.stringify(item),
          );
        }
        return resultData;
      }
    }
  }
  return undefined;
}

/**
 * Full decode pipeline: strip prefix → parse chunks → extract result.
 */
export function decodeResponse(rawResponse: string, rpcId: string, allowNull = false): unknown {
  const cleaned = stripAntiXSSI(rawResponse);
  const chunks = parseChunkedResponse(cleaned);
  const responsePreview = cleaned.slice(0, 500);
  const foundIds = collectRPCIds(chunks);

  let result: unknown;
  try {
    result = extractRPCResult(chunks, rpcId);
  } catch (e) {
    if (e instanceof RPCError && e.foundIds.length === 0) {
      throw new RPCError(e.message, {
        methodId: e.methodId,
        rpcCode: e.rpcCode,
        foundIds,
        rawResponse: responsePreview,
      });
    }
    throw e;
  }

  if (result === undefined && !allowNull) {
    if (foundIds.length > 0 && !foundIds.includes(rpcId)) {
      throw new RPCError(
        `No result for RPC ID '${rpcId}'. Response has IDs: ${foundIds.join(", ")}. Method ID may have changed.`,
        { methodId: rpcId, foundIds, rawResponse: responsePreview },
      );
    }
    throw new RPCError(`No result found for RPC ID: ${rpcId} (${chunks.length} chunks parsed)`, {
      methodId: rpcId,
      foundIds,
      rawResponse: responsePreview,
    });
  }

  return result ?? null;
}
