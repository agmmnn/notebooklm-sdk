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
    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
    
    let params: unknown[];
    if (isYouTube) {
      params = [
        [[null, null, null, null, null, null, null, [url], null, null, 1]],
        notebookId,
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]],
      ];
    } else {
      params = [
        [[null, null, [url], null, null, null, null, null]],
        notebookId,
        [2],
        null,
        null,
      ];
    }

    const result = await this.rpc.call(RPCMethod.ADD_SOURCE, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: isYouTube,
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
    const params = [
      [[null, [title ?? "", text], null, null, null, null, null, null]],
      notebookId,
      [2],
      null,
      null,
    ];

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
    // Step 1: Register file source intent to get SOURCE_ID
    const params = [
      [[fileName]],
      notebookId,
      [2],
      [1, null, null, null, null, null, null, null, null, null, [1]],
    ];

    const result = await this.rpc.call(RPCMethod.ADD_SOURCE_FILE, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });

    const sourceId = extractSourceId(result);

    // Step 2: Start resumable upload session
    const uploadUrl = await this.startResumableUpload(notebookId, fileName, data.length, sourceId);

    // Step 3: Stream/upload final file content
    await this.uploadFile(uploadUrl, data);

    if (opts.waitUntilReady) {
      return this.waitUntilReady(notebookId, sourceId, opts.waitTimeout);
    }

    return {
      id: sourceId,
      title: fileName,
      url: null,
      kind: "pdf", // Defaults to generic kind until ready
      createdAt: null,
      status: "processing",
      _typeCode: null,
    };
  }

  private async startResumableUpload(
    notebookId: string,
    fileName: string,
    fileSize: number,
    sourceId: string,
  ): Promise<string> {
    const startResp = await fetch(`${UPLOAD_URL}?authuser=0`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Cookie: this.auth.cookieHeader,
        Origin: "https://notebooklm.google.com",
        Referer: "https://notebooklm.google.com/",
        "x-goog-authuser": "0",
        "x-goog-upload-command": "start",
        "x-goog-upload-header-content-length": String(fileSize),
        "x-goog-upload-protocol": "resumable",
      },
      body: JSON.stringify({
        PROJECT_ID: notebookId,
        SOURCE_NAME: fileName,
        SOURCE_ID: sourceId,
      }),
    });

    if (!startResp.ok) {
      throw new Error(`Upload initiation failed: HTTP ${startResp.status}`);
    }

    const uploadSessionUrl = startResp.headers.get("x-goog-upload-url");
    if (!uploadSessionUrl) {
      throw new Error("Failed to get upload URL from response headers");
    }

    return uploadSessionUrl;
  }

  private async uploadFile(
    uploadUrl: string,
    data: Buffer | Uint8Array,
  ): Promise<string> {
    const uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        Cookie: this.auth.cookieHeader,
        Origin: "https://notebooklm.google.com",
        Referer: "https://notebooklm.google.com/",
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0",
      },
      body: new Uint8Array(data),
    });

    if (!uploadResp.ok) {
      throw new Error(`File upload failed: HTTP ${uploadResp.status}`);
    }

    const uploadResult = await uploadResp.text();
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
    // Navigate down the first elements to find the deeply nested ID
    // e.g., [[[[["id"], ...]]]], [[["id", title]]]
    let current: unknown = result;
    while (Array.isArray(current) && current.length > 0) {
      if (typeof current[0] === "string") {
        // Only return if it's a UUID-like string or long enough
        if (current[0].length > 8) {
          return current[0];
        }
      }
      current = current[0];
    }

    // Fallback flat search
    for (const item of result) {
      if (typeof item === "string" && item.length > 8) return item;
    }
  }
  if (typeof result === "string") return result;
  console.log("extractSourceId debug info: could not parse:", JSON.stringify(result, null, 2));
  throw new Error("Could not extract source ID from API response");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
