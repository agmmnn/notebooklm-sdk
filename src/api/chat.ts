import { RPCMethod } from "../types/enums.js";
import { ChatError } from "../types/errors.js";
import type { AskResult, ChatReference, ConversationTurn } from "../types/models.js";
import type { RPCCore } from "../rpc/core.js";
import type { AuthTokens } from "../auth.js";

const QUERY_URL =
  "https://notebooklm.google.com/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed";

const DEFAULT_BL = "boq_labs-tailwind-frontend_20260301.03_p0";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AskOptions {
  conversationId?: string;
  sourceIds?: string[];
}

interface CachedTurn {
  query: string;
  answer: string;
  turnNumber: number;
}

export class ChatAPI {
  private readonly conversationCache = new Map<string, CachedTurn[]>();
  private reqid = Math.floor(Math.random() * 900_000) + 100_000;

  constructor(
    private readonly rpc: RPCCore,
    private readonly auth: AuthTokens,
  ) {}

  async ask(notebookId: string, query: string, opts: AskOptions = {}): Promise<AskResult> {
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const isNew = !opts.conversationId;
    const conversationId = opts.conversationId ?? randomUUID();

    const history = isNew ? null : this._buildHistory(conversationId);
    // Sources are triple-nested: [[[sid]], [[sid]], ...]
    const sourcesArray = sourceIds.map((sid) => [[sid]]);

    const params = [
      sourcesArray,
      query,
      history,
      [2, null, [1], [1]],
      conversationId,
      null,
      null,
      notebookId,
      1,
    ];

    const paramsJson = JSON.stringify(params, null, 0);
    const fReq = JSON.stringify([null, paramsJson]);

    this.reqid += 100_000;
    const bl = (typeof process !== "undefined" && process.env["NOTEBOOKLM_BL"]) || DEFAULT_BL;

    const urlParams = new URLSearchParams({ bl, hl: "en", _reqid: String(this.reqid), rt: "c" });
    if (this.auth.sessionId) urlParams.set("f.sid", this.auth.sessionId);

    const bodyParts = [`f.req=${encodeURIComponent(fReq)}`];
    if (this.auth.csrfToken) bodyParts.push(`at=${encodeURIComponent(this.auth.csrfToken)}`);
    const body = bodyParts.join("&") + "&";

    let response: Response;
    try {
      response = await fetch(`${QUERY_URL}?${urlParams.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Cookie: this.auth.cookieHeader,
        },
        body,
      });
    } catch (e) {
      throw new ChatError(`Chat request failed: ${String(e)}`);
    }

    if (!response.ok) throw new ChatError(`Chat request failed: HTTP ${response.status}`);

    const text = await response.text();
    const { answer, conversationId: serverConvId, references } = parseStreamingResponse(text);

    const finalConvId = serverConvId ?? conversationId;
    const cached = this.conversationCache.get(finalConvId) ?? [];
    const turnNumber = cached.length + 1;
    cached.push({ query, answer, turnNumber });
    this.conversationCache.set(finalConvId, cached);

    return { answer, conversationId: finalConvId, turnNumber, references };
  }

  async getConversationTurns(
    notebookId: string,
    conversationId: string,
  ): Promise<ConversationTurn[]> {
    // params: [[], null, null, conversation_id, limit]
    const params = [[], null, null, conversationId, 100];
    const result = await this.rpc.call(RPCMethod.GET_CONVERSATION_TURNS, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });

    if (!Array.isArray(result) || !Array.isArray(result[0])) return [];

    // API returns individual turns newest-first; reverse to chronological
    const rawTurns = [...(result[0] as unknown[])].reverse();
    const turns: ConversationTurn[] = [];

    let i = 0;
    while (i < rawTurns.length) {
      const turn = rawTurns[i];
      if (!Array.isArray(turn) || turn.length < 3) {
        i++;
        continue;
      }
      if (turn[2] === 1 && turn.length > 3) {
        const q = typeof turn[3] === "string" ? (turn[3] as string) : "";
        let a = "";
        const next = rawTurns[i + 1];
        if (Array.isArray(next) && next.length > 4 && next[2] === 2) {
          try {
            a = String(((next[4] as unknown[][])[0] as unknown[])[0] ?? "");
          } catch {
            /* ignore */
          }
          i++;
        }
        turns.push({ query: q, answer: a, turnNumber: turns.length + 1 });
      }
      i++;
    }
    return turns;
  }

  async getLastConversationId(notebookId: string): Promise<string | null> {
    // params: [[], null, notebook_id, 1]
    const params = [[], null, notebookId, 1];
    const result = await this.rpc.call(RPCMethod.GET_LAST_CONVERSATION_ID, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    // Response structure: [[[conv_id]]]
    if (!Array.isArray(result)) return null;
    for (const group of result as unknown[]) {
      if (!Array.isArray(group)) continue;
      for (const conv of group as unknown[]) {
        if (Array.isArray(conv) && typeof (conv as unknown[])[0] === "string") {
          return (conv as unknown[])[0] as string;
        }
      }
    }
    return null;
  }

  clearCache(conversationId?: string): void {
    if (conversationId) {
      this.conversationCache.delete(conversationId);
    } else {
      this.conversationCache.clear();
    }
  }

  private _buildHistory(conversationId: string): unknown[] | null {
    const turns = this.conversationCache.get(conversationId) ?? [];
    if (!turns.length) return null;
    const history: unknown[] = [];
    for (const turn of turns) {
      history.push([turn.answer, null, 2]);
      history.push([turn.query, null, 1]);
    }
    return history;
  }
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

interface ParsedResponse {
  answer: string;
  conversationId: string | null;
  references: ChatReference[];
}

function parseStreamingResponse(rawText: string): ParsedResponse {
  let text = rawText;
  if (text.startsWith(")]}'")) text = text.slice(4);

  const lines = text.trim().split("\n");
  let bestMarkedAnswer = "";
  let bestUnmarkedAnswer = "";
  let serverConvId: string | null = null;
  const references: ChatReference[] = [];

  function processChunk(jsonStr: string): void {
    let data: unknown;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return;
    }
    if (!Array.isArray(data)) return;

    for (const item of data as unknown[]) {
      if (!Array.isArray(item) || item.length < 3 || (item as unknown[])[0] !== "wrb.fr") continue;
      const innerJson = (item as unknown[])[2];
      if (typeof innerJson !== "string") continue;

      let innerData: unknown;
      try {
        innerData = JSON.parse(innerJson);
      } catch {
        continue;
      }
      if (!Array.isArray(innerData) || !innerData.length) continue;

      const first = (innerData as unknown[])[0];
      if (!Array.isArray(first) || !first.length) continue;

      const answerText = (first as unknown[])[0];
      if (typeof answerText !== "string" || !answerText) continue;

      const typeInfo = (first as unknown[])[4];
      const isAnswer =
        Array.isArray(typeInfo) && typeInfo.length > 0 && typeInfo[typeInfo.length - 1] === 1;

      const convData = (first as unknown[])[2];
      if (
        !serverConvId &&
        Array.isArray(convData) &&
        convData.length > 0 &&
        typeof (convData as unknown[])[0] === "string"
      ) {
        serverConvId = (convData as unknown[])[0] as string;
      }

      // Extract references (sourceIds) from first[4][3]
      if (Array.isArray(typeInfo) && typeInfo.length > 3) {
        const citations = typeInfo[3];
        if (Array.isArray(citations)) {
          for (const cite of citations as unknown[]) {
            const sourceId = extractUuid(cite);
            if (sourceId) {
              references.push({ sourceId, title: null, url: null });
            }
          }
        }
      }

      if (isAnswer && answerText.length > bestMarkedAnswer.length) {
        bestMarkedAnswer = answerText;
      } else if (!isAnswer && answerText.length > bestUnmarkedAnswer.length) {
        bestUnmarkedAnswer = answerText;
      }
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = (lines[i] ?? "").trim();
    if (!line) {
      i++;
      continue;
    }
    if (/^\d+$/.test(line)) {
      i++;
      const next = lines[i];
      if (next !== undefined) processChunk(next);
      i++;
    } else {
      processChunk(line);
      i++;
    }
  }

  return {
    answer: bestMarkedAnswer || bestUnmarkedAnswer,
    conversationId: serverConvId,
    references,
  };
}

function extractUuid(data: unknown, depth = 8): string | null {
  if (depth <= 0 || data == null) return null;
  if (typeof data === "string") return UUID_RE.test(data) ? data : null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractUuid(item, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

function randomUUID(): string {
  // Use Web Crypto API (available in Node 19+, Bun, Deno)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: simple UUID v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
