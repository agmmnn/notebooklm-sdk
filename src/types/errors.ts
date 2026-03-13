/**
 * All exceptions for notebooklm-sdk.
 *
 * All errors extend NotebookLMError so you can catch everything with:
 *   try { ... } catch (e) { if (e instanceof NotebookLMError) ... }
 */

export class NotebookLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ---------------------------------------------------------------------------
// Network (transport-level, before RPC processing)
// ---------------------------------------------------------------------------

export class NetworkError extends NotebookLMError {
  readonly methodId?: string;
  readonly originalError?: Error;

  constructor(message: string, opts: { methodId?: string; originalError?: Error } = {}) {
    super(message);
    this.methodId = opts.methodId;
    this.originalError = opts.originalError;
  }
}

export class RPCTimeoutError extends NetworkError {}

// ---------------------------------------------------------------------------
// RPC Protocol (after connection established)
// ---------------------------------------------------------------------------

export class RPCError extends NotebookLMError {
  readonly methodId?: string;
  readonly rawResponse?: string;
  readonly rpcCode?: string | number;
  readonly foundIds: string[];

  constructor(
    message: string,
    opts: {
      methodId?: string;
      rawResponse?: string;
      rpcCode?: string | number;
      foundIds?: string[];
    } = {},
  ) {
    super(message);
    this.methodId = opts.methodId;
    this.rawResponse = opts.rawResponse ? opts.rawResponse.slice(0, 500) : undefined;
    this.rpcCode = opts.rpcCode;
    this.foundIds = opts.foundIds ?? [];
  }
}

export class AuthError extends RPCError {}

export class RateLimitError extends RPCError {
  readonly retryAfter?: number;

  constructor(
    message: string,
    opts: {
      retryAfter?: number;
      methodId?: string;
      rawResponse?: string;
      rpcCode?: string | number;
      foundIds?: string[];
    } = {},
  ) {
    super(message, opts);
    this.retryAfter = opts.retryAfter;
  }
}

export class ServerError extends RPCError {
  readonly statusCode?: number;

  constructor(
    message: string,
    opts: {
      statusCode?: number;
      methodId?: string;
      rawResponse?: string;
      rpcCode?: string | number;
    } = {},
  ) {
    super(message, opts);
    this.statusCode = opts.statusCode;
  }
}

export class ClientError extends RPCError {
  readonly statusCode?: number;

  constructor(
    message: string,
    opts: {
      statusCode?: number;
      methodId?: string;
      rawResponse?: string;
      rpcCode?: string | number;
    } = {},
  ) {
    super(message, opts);
    this.statusCode = opts.statusCode;
  }
}

// ---------------------------------------------------------------------------
// Domain: Notebooks
// ---------------------------------------------------------------------------

export class NotebookError extends NotebookLMError {}

export class NotebookNotFoundError extends NotebookError {
  readonly notebookId: string;

  constructor(notebookId: string) {
    super(`Notebook not found: ${notebookId}`);
    this.notebookId = notebookId;
  }
}

// ---------------------------------------------------------------------------
// Domain: Sources
// ---------------------------------------------------------------------------

export class SourceError extends NotebookLMError {}

export class SourceNotFoundError extends SourceError {
  readonly sourceId: string;

  constructor(sourceId: string) {
    super(`Source not found: ${sourceId}`);
    this.sourceId = sourceId;
  }
}

export class SourceAddError extends SourceError {
  readonly url: string;
  readonly cause?: Error;

  constructor(url: string, opts: { cause?: Error; message?: string } = {}) {
    super(
      opts.message ??
        `Failed to add source: ${url}\n` +
          "Possible causes:\n" +
          "  - URL is invalid or inaccessible\n" +
          "  - Content is behind a paywall or requires authentication\n" +
          "  - Rate limiting or quota exceeded",
    );
    this.url = url;
    this.cause = opts.cause;
  }
}

export class SourceProcessingError extends SourceError {
  readonly sourceId: string;
  readonly status: number;

  constructor(sourceId: string, status = 3, message?: string) {
    super(message ?? `Source ${sourceId} failed to process`);
    this.sourceId = sourceId;
    this.status = status;
  }
}

export class SourceTimeoutError extends SourceError {
  readonly sourceId: string;
  readonly timeout: number;
  readonly lastStatus?: number;

  constructor(sourceId: string, timeout: number, lastStatus?: number) {
    const statusInfo = lastStatus != null ? ` (last status: ${lastStatus})` : "";
    super(`Source ${sourceId} not ready after ${timeout.toFixed(1)}s${statusInfo}`);
    this.sourceId = sourceId;
    this.timeout = timeout;
    this.lastStatus = lastStatus;
  }
}

// ---------------------------------------------------------------------------
// Domain: Artifacts
// ---------------------------------------------------------------------------

export class ArtifactError extends NotebookLMError {}

export class ArtifactNotFoundError extends ArtifactError {
  readonly artifactId: string;
  readonly artifactType?: string;

  constructor(artifactId: string, artifactType?: string) {
    const typeInfo = artifactType ? ` ${artifactType}` : "";
    super(`${typeInfo.trim() || "Artifact"} ${artifactId} not found`);
    this.artifactId = artifactId;
    this.artifactType = artifactType;
  }
}

export class ArtifactNotReadyError extends ArtifactError {
  readonly artifactType: string;
  readonly artifactId?: string;
  readonly status?: string;

  constructor(artifactType: string, opts: { artifactId?: string; status?: string } = {}) {
    const base = opts.artifactId
      ? `${artifactType} artifact ${opts.artifactId} is not ready`
      : `No completed ${artifactType} found`;
    const statusInfo = opts.status ? ` (status: ${opts.status})` : "";
    super(`${base}${statusInfo}`);
    this.artifactType = artifactType;
    this.artifactId = opts.artifactId;
    this.status = opts.status;
  }
}

export class ArtifactParseError extends ArtifactError {
  readonly artifactType: string;
  readonly artifactId?: string;
  readonly details?: string;
  readonly cause?: Error;

  constructor(
    artifactType: string,
    opts: { details?: string; artifactId?: string; cause?: Error } = {},
  ) {
    let msg = `Failed to parse ${artifactType} artifact`;
    if (opts.artifactId) msg += ` ${opts.artifactId}`;
    if (opts.details) msg += `: ${opts.details}`;
    super(msg);
    this.artifactType = artifactType;
    this.artifactId = opts.artifactId;
    this.details = opts.details;
    this.cause = opts.cause;
  }
}

export class ArtifactDownloadError extends ArtifactError {
  readonly artifactType: string;
  readonly artifactId?: string;
  readonly details?: string;
  readonly cause?: Error;

  constructor(
    artifactType: string,
    opts: { details?: string; artifactId?: string; cause?: Error } = {},
  ) {
    let msg = `Failed to download ${artifactType} artifact`;
    if (opts.artifactId) msg += ` ${opts.artifactId}`;
    if (opts.details) msg += `: ${opts.details}`;
    super(msg);
    this.artifactType = artifactType;
    this.artifactId = opts.artifactId;
    this.details = opts.details;
    this.cause = opts.cause;
  }
}

// ---------------------------------------------------------------------------
// Domain: Chat
// ---------------------------------------------------------------------------

export class ChatError extends NotebookLMError {}
