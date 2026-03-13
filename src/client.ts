import { connect } from "./auth.js";
import type { AuthTokens, ConnectOptions } from "./auth.js";
import { RPCCore } from "./rpc/core.js";
import { NotebooksAPI } from "./api/notebooks.js";
import { SourcesAPI } from "./api/sources.js";
import { ArtifactsAPI } from "./api/artifacts.js";
import { ChatAPI } from "./api/chat.js";
import { NotesAPI } from "./api/notes.js";
import { ResearchAPI } from "./api/research.js";
import { SettingsAPI } from "./api/settings.js";
import { SharingAPI } from "./api/sharing.js";

export interface ClientOptions {
  /** HTTP request timeout in milliseconds. Default: 30000 */
  timeoutMs?: number;
}

/**
 * NotebookLM SDK client.
 *
 * @example
 * ```ts
 * const client = await NotebookLMClient.connect({
 *   cookies: process.env.NOTEBOOKLM_COOKIES,
 * });
 * const notebooks = await client.notebooks.list();
 * ```
 */
export class NotebookLMClient {
  readonly notebooks: NotebooksAPI;
  readonly sources: SourcesAPI;
  readonly artifacts: ArtifactsAPI;
  readonly chat: ChatAPI;
  readonly notes: NotesAPI;
  readonly research: ResearchAPI;
  readonly settings: SettingsAPI;
  readonly sharing: SharingAPI;

  private constructor(
    private readonly auth: AuthTokens,
    opts: ClientOptions = {},
  ) {
    const rpc = new RPCCore(auth, opts.timeoutMs);
    this.notebooks = new NotebooksAPI(rpc);
    this.sources = new SourcesAPI(rpc, auth);
    this.artifacts = new ArtifactsAPI(rpc, auth);
    this.chat = new ChatAPI(rpc, auth);
    this.notes = new NotesAPI(rpc);
    this.research = new ResearchAPI(rpc);
    this.settings = new SettingsAPI(rpc);
    this.sharing = new SharingAPI(rpc);
  }

  /**
   * Connect to NotebookLM using cookies.
   * Fetches CSRF and session tokens from the NotebookLM homepage.
   */
  static async connect(
    opts: ConnectOptions,
    clientOpts: ClientOptions = {},
  ): Promise<NotebookLMClient> {
    const auth = await connect(opts);
    return new NotebookLMClient(auth, clientOpts);
  }

  /**
   * Refresh CSRF and session tokens (e.g. if they expire mid-session).
   */
  async refreshTokens(): Promise<void> {
    const { fetchTokens } = await import("./auth.js");
    const { csrfToken, sessionId } = await fetchTokens(this.auth.cookies);
    (this.auth as { csrfToken: string }).csrfToken = csrfToken;
    (this.auth as { sessionId: string }).sessionId = sessionId;
  }
}
