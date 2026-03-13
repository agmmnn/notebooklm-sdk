import { RPCMethod } from "../types/enums.js";
import { ChatError } from "../types/errors.js";
import type { AskResult, ChatReference, ConversationTurn } from "../types/models.js";
import type { RPCCore } from "../rpc/core.js";
import type { AuthTokens } from "../auth.js";

const QUERY_URL =
  "https://notebooklm.google.com/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed";

export interface AskOptions {
  conversationId?: string;
  sourceIds?: string[];
  /** Include conversation history for multi-turn chat */
  history?: ConversationTurn[];
}

export class ChatAPI {
  private conversationCache = new Map<string, ConversationTurn[]>();

  constructor(
    private readonly rpc: RPCCore,
    private readonly auth: AuthTokens,
  ) {}

  async ask(notebookId: string, query: string, opts: AskOptions = {}): Promise<AskResult> {
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const conversationId = opts.conversationId ?? null;
    const history =
      opts.history ?? (conversationId ? (this.conversationCache.get(conversationId) ?? []) : []);

    // Build request payload
    const turns = history.map((t) => [t.query, t.answer]);
    const requestPayload = {
      notebookId,
      query,
      turns,
      sourceIds,
      conversationId,
    };

    const response = await this._streamingQuery(notebookId, requestPayload);
    const parsed = parseStreamingResponse(response);

    // Cache the turn
    const convId = parsed.conversationId ?? conversationId ?? `conv_${Date.now()}`;
    const cached = this.conversationCache.get(convId) ?? [];
    cached.push({ query, answer: parsed.answer, turnNumber: parsed.turnNumber });
    this.conversationCache.set(convId, cached);

    return {
      answer: parsed.answer,
      conversationId: convId,
      turnNumber: parsed.turnNumber,
      references: parsed.references,
    };
  }

  async getConversationTurns(
    notebookId: string,
    conversationId: string,
  ): Promise<ConversationTurn[]> {
    const params = [notebookId, conversationId, [2]];
    const result = await this.rpc.call(RPCMethod.GET_CONVERSATION_TURNS, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    if (!Array.isArray(result)) return [];
    const turns: ConversationTurn[] = [];

    try {
      const turnsData = result[0] as unknown[][];
      if (!Array.isArray(turnsData)) return [];
      let turnNum = 1;
      for (const turn of turnsData) {
        if (!Array.isArray(turn)) continue;
        const query = typeof turn[0] === "string" ? (turn[0] as string) : "";
        const answer = typeof turn[1] === "string" ? (turn[1] as string) : "";
        turns.push({ query, answer, turnNumber: turnNum++ });
      }
    } catch {
      // ignore
    }
    return turns;
  }

  async getLastConversationId(notebookId: string): Promise<string | null> {
    const params = [notebookId, [2]];
    const result = await this.rpc.call(RPCMethod.GET_LAST_CONVERSATION_ID, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    if (typeof result === "string") return result;
    if (Array.isArray(result) && typeof result[0] === "string") return result[0] as string;
    return null;
  }

  clearCache(conversationId?: string): void {
    if (conversationId) {
      this.conversationCache.delete(conversationId);
    } else {
      this.conversationCache.clear();
    }
  }

  private async _streamingQuery(notebookId: string, payload: unknown): Promise<string> {
    const body = JSON.stringify(payload);

    const params = new URLSearchParams({
      "source-path": `/notebook/${notebookId}`,
      "f.sid": this.rpc["auth" as never] ? "" : "",
    });

    const response = await fetch(`${QUERY_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: this.auth.cookieHeader,
      },
      body,
    });

    if (!response.ok) {
      throw new ChatError(`Chat request failed: HTTP ${response.status}`);
    }

    return response.text();
  }
}

interface ParsedResponse {
  answer: string;
  conversationId: string | null;
  turnNumber: number;
  references: ChatReference[];
}

function parseStreamingResponse(rawText: string): ParsedResponse {
  // The streaming response may be JSON or chunked
  // Try to extract the answer from the response
  let answer = "";
  let conversationId: string | null = null;
  let turnNumber = 1;
  const references: ChatReference[] = [];

  try {
    // Try direct JSON parse
    const data = JSON.parse(rawText) as Record<string, unknown>;
    if (typeof data["answer"] === "string") {
      answer = data["answer"] as string;
    }
    if (typeof data["conversationId"] === "string") {
      conversationId = data["conversationId"] as string;
    }
  } catch {
    // Try to extract from streaming format
    // Look for JSON objects in the stream
    const matches = rawText.matchAll(/\{[^{}]*"answer"[^{}]*\}/g);
    for (const match of matches) {
      try {
        const obj = JSON.parse(match[0]) as Record<string, unknown>;
        if (typeof obj["answer"] === "string") {
          answer = obj["answer"] as string;
          break;
        }
      } catch {
        // ignore
      }
    }

    // Fallback: return raw text if we can't parse it
    if (!answer) {
      answer = rawText;
    }
  }

  return { answer, conversationId, turnNumber, references };
}
