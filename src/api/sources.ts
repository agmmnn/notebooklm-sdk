import { readFileSync } from "node:fs";
import { RPCMethod } from "../types/enums.js";
import { SourceProcessingError, SourceTimeoutError } from "../types/errors.js";
import { parseSource } from "../types/models.js";
import type { Source } from "../types/models.js";
import type { RPCCore } from "../rpc/core.js";
import type { AuthTokens } from "../auth.js";

const UPLOAD_URL = "https://notebooklm.google.com/upload/_/";

export interface AddSourceOptions {
  waitUntilReady?: boolean;
  waitTimeout?: number;
}

export class SourcesAPI {
  constructor(
    private readonly rpc: RPCCore,
    private readonly auth: AuthTokens,
  ) {}

  async list(notebookId: string): Promise<Source[]> {
    const params = [notebookId, null, [2], null, 0];
    const notebook = await this.rpc.call(RPCMethod.GET_NOTEBOOK, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    if (!Array.isArray(notebook) || !notebook.length) return [];
    const nbInfo = notebook[0] as unknown[];
    if (!Array.isArray(nbInfo) || nbInfo.length <= 1) return [];
    const sourcesList = nbInfo[1] as unknown[][];
    if (!Array.isArray(sourcesList)) return [];

    return sourcesList
      .filter((s) => Array.isArray(s) && s.length > 0)
      .map((s) => parseSource(s as unknown[]));
  }

  async get(notebookId: string, sourceId: string): Promise<Source | null> {
    const sources = await this.list(notebookId);
    return sources.find((s) => s.id === sourceId) ?? null;
  }

  async addUrl(notebookId: string, url: string, opts: AddSourceOptions = {}): Promise<Source> {
    const params = [notebookId, [[url]], null, null, [2]];
    const result = await this.rpc.call(RPCMethod.ADD_SOURCE, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    const sourceId = extractSourceId(result);
    if (opts.waitUntilReady) {
      return this.waitUntilReady(notebookId, sourceId, opts.waitTimeout);
    }
    return {
      id: sourceId,
      title: url,
      url,
      kind: "web_page",
      createdAt: null,
      status: "processing",
      _typeCode: null,
    };
  }

  async addText(
    notebookId: string,
    text: string,
    title?: string,
    opts: AddSourceOptions = {},
  ): Promise<Source> {
    // Pasted text uses ADD_SOURCE with a special format
    const params = [notebookId, null, [[null, null, null, text, title ?? null]], null, [2]];
    const result = await this.rpc.call(RPCMethod.ADD_SOURCE, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    const sourceId = extractSourceId(result);
    if (opts.waitUntilReady) {
      return this.waitUntilReady(notebookId, sourceId, opts.waitTimeout);
    }
    return {
      id: sourceId,
      title: title ?? null,
      url: null,
      kind: "pasted_text",
      createdAt: null,
      status: "processing",
      _typeCode: null,
    };
  }

  async addFile(
    notebookId: string,
    filePath: string,
    mimeType: string,
    opts: AddSourceOptions = {},
  ): Promise<Source> {
    const fileData = readFileSync(filePath);
    const fileName = filePath.split("/").pop() ?? "file";
    return this.addFileBuffer(notebookId, fileData, fileName, mimeType, opts);
  }

  async addFileBuffer(
    notebookId: string,
    data: Buffer | Uint8Array,
    fileName: string,
    mimeType: string,
    opts: AddSourceOptions = {},
  ): Promise<Source> {
    // Step 1: Upload file
    const uploadUrl = await this.uploadFile(notebookId, data, fileName, mimeType);

    // Step 2: Register as source
    const params = [notebookId, null, null, [[uploadUrl, fileName, mimeType]], [2]];
    const result = await this.rpc.call(RPCMethod.ADD_SOURCE_FILE, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    const sourceId = extractSourceId(result);
    if (opts.waitUntilReady) {
      return this.waitUntilReady(notebookId, sourceId, opts.waitTimeout);
    }
    return {
      id: sourceId,
      title: fileName,
      url: null,
      kind: "pdf",
      createdAt: null,
      status: "processing",
      _typeCode: null,
    };
  }

  private async uploadFile(
    notebookId: string,
    data: Buffer | Uint8Array,
    fileName: string,
    mimeType: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      "source-path": `/notebook/${notebookId}`,
      upload_id: `${Date.now()}`,
      upload_protocol: "resumable",
    });

    // Initiate resumable upload
    const initResp = await fetch(`${UPLOAD_URL}?${params}`, {
      method: "POST",
      headers: {
        Cookie: this.auth.cookieHeader,
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(data.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "X-Upload-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: fileName }),
    });

    if (!initResp.ok) {
      throw new Error(`Upload initiation failed: HTTP ${initResp.status}`);
    }

    const uploadSessionUrl = initResp.headers.get("x-goog-upload-url") ?? `${UPLOAD_URL}?${params}`;

    // Upload the file data
    const uploadResp = await fetch(uploadSessionUrl, {
      method: "POST",
      headers: {
        Cookie: this.auth.cookieHeader,
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0",
        "Content-Type": mimeType,
        "Content-Length": String(data.length),
      },
      body: data instanceof Buffer ? (data.buffer as ArrayBuffer) : (data.buffer as ArrayBuffer),
    });

    if (!uploadResp.ok) {
      throw new Error(`File upload failed: HTTP ${uploadResp.status}`);
    }

    const uploadResult = await uploadResp.text();
    // The response contains the file URL
    return uploadResult.trim();
  }

  async delete(notebookId: string, sourceId: string): Promise<boolean> {
    const params = [notebookId, [sourceId], [2]];
    await this.rpc.call(RPCMethod.DELETE_SOURCE, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return true;
  }

  async refresh(notebookId: string, sourceId: string): Promise<boolean> {
    const params = [notebookId, sourceId, [2]];
    await this.rpc.call(RPCMethod.REFRESH_SOURCE, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return true;
  }

  async waitUntilReady(
    notebookId: string,
    sourceId: string,
    timeout = 120,
    initialInterval = 1,
    maxInterval = 10,
    backoffFactor = 1.5,
  ): Promise<Source> {
    const deadline = Date.now() + timeout * 1000;
    let interval = initialInterval;
    let lastStatus: number | undefined;

    while (Date.now() < deadline) {
      const source = await this.get(notebookId, sourceId);
      if (source) {
        if (source.status === "ready") return source;
        if (source.status === "error") {
          throw new SourceProcessingError(sourceId, 3);
        }
        lastStatus = source._typeCode ?? undefined;
      }

      await sleep(interval * 1000);
      interval = Math.min(interval * backoffFactor, maxInterval);
    }

    throw new SourceTimeoutError(sourceId, timeout, lastStatus);
  }
}

function extractSourceId(result: unknown): string {
  // Source ID appears in various positions depending on the RPC
  if (Array.isArray(result)) {
    // Try result[0][0][0] or result[0][0][0][0] pattern
    try {
      const v0 = result[0];
      if (Array.isArray(v0)) {
        const v00 = v0[0];
        if (Array.isArray(v00)) {
          const v000 = v00[0];
          if (Array.isArray(v000) && typeof v000[0] === "string") return v000[0];
          if (typeof v000 === "string") return v000;
        }
        if (typeof v00 === "string") return v00;
      }
      if (typeof v0 === "string") return v0;
    } catch {
      // ignore
    }
    // Flat string in result
    for (const item of result as unknown[]) {
      if (typeof item === "string" && item.length > 8) return item;
    }
  }
  if (typeof result === "string") return result;
  throw new Error("Could not extract source ID from API response");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
