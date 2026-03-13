import type { AuthTokens } from "../auth.js";
import type { RPCCore } from "../rpc/core.js";
import type {
  AudioFormatValue,
  AudioLengthValue,
  InfographicDetailValue,
  InfographicOrientationValue,
  InfographicStyleValue,
  QuizDifficultyValue,
  QuizQuantityValue,
  SlideDeckFormatValue,
  SlideDeckLengthValue,
  VideoFormatValue,
  VideoStyleValue,
} from "../types/enums.js";
import {
  ArtifactTypeCode,
  AudioFormat,
  AudioLength,
  artifactStatusFromCode,
  InfographicDetail,
  InfographicOrientation,
  InfographicStyle,
  QuizDifficulty,
  QuizQuantity,
  RPCMethod,
  SlideDeckFormat,
  SlideDeckLength,
  VideoFormat,
  VideoStyle,
} from "../types/enums.js";
import { ArtifactNotReadyError } from "../types/errors.js";
import type { Artifact, GenerationStatus } from "../types/models.js";
import { parseArtifact } from "../types/models.js";

export interface CreateAudioOptions {
  format?: AudioFormatValue;
  length?: AudioLengthValue;
  sourceIds?: string[];
  instructions?: string;
  language?: string;
}

export interface CreateVideoOptions {
  format?: VideoFormatValue;
  style?: VideoStyleValue;
  sourceIds?: string[];
  instructions?: string;
  language?: string;
}

export interface CreateQuizOptions {
  quantity?: QuizQuantityValue;
  difficulty?: QuizDifficultyValue;
  sourceIds?: string[];
  instructions?: string;
}

export interface CreateInfographicOptions {
  orientation?: InfographicOrientationValue;
  detail?: InfographicDetailValue;
  style?: InfographicStyleValue;
  sourceIds?: string[];
  instructions?: string;
  language?: string;
}

export interface CreateSlideDeckOptions {
  format?: SlideDeckFormatValue;
  length?: SlideDeckLengthValue;
  sourceIds?: string[];
  instructions?: string;
  language?: string;
}

export type ReportFormat = "briefing_doc" | "study_guide" | "blog_post" | "custom";

export interface CreateReportOptions {
  format?: ReportFormat;
  sourceIds?: string[];
  language?: string;
  customPrompt?: string;
  extraInstructions?: string;
}

// Triple-nest source IDs as required by the API: [[[sid]], [[sid]], ...]
function tripleNest(ids: string[]): string[][][] {
  return ids.map((id) => [[id]]);
}

// Double-nest source IDs: [[sid], [sid], ...]
function doubleNest(ids: string[]): string[][] {
  return ids.map((id) => [id]);
}

export class ArtifactsAPI {
  constructor(
    private readonly rpc: RPCCore,
    private readonly auth: AuthTokens,
  ) {}

  async list(notebookId: string): Promise<Artifact[]> {
    const params = [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"'];
    const result = await this.rpc.call(RPCMethod.LIST_ARTIFACTS, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });

    if (!Array.isArray(result) || !result.length) return [];
    const rawList = Array.isArray(result[0]) ? (result[0] as unknown[][]) : (result as unknown[][]);

    const artifacts: Artifact[] = [];
    for (const item of rawList) {
      if (Array.isArray(item)) {
        try {
          artifacts.push(parseArtifact(item, notebookId));
        } catch {
          // ignore malformed items
        }
      }
    }
    return artifacts;
  }

  async get(notebookId: string, artifactId: string): Promise<Artifact | null> {
    const artifacts = await this.list(notebookId);
    return artifacts.find((a) => a.id === artifactId) ?? null;
  }

  async delete(notebookId: string, artifactId: string): Promise<boolean> {
    const params = [[2], notebookId, artifactId];
    await this.rpc.call(RPCMethod.DELETE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return true;
  }

  async rename(notebookId: string, artifactId: string, newTitle: string): Promise<boolean> {
    const params = [[2], notebookId, artifactId, newTitle];
    await this.rpc.call(RPCMethod.RENAME_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  async createAudio(notebookId: string, opts: CreateAudioOptions = {}): Promise<GenerationStatus> {
    const format = opts.format ?? null;
    const length = opts.length ?? null;
    const language = opts.language ?? "en";
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const triple = tripleNest(sourceIds);
    const double = doubleNest(sourceIds);

    // config at index 6 (no extra null before it)
    const params = [
      [2],
      notebookId,
      [
        null,
        null,
        ArtifactTypeCode.AUDIO,
        triple,
        null,
        null,
        [null, [opts.instructions ?? null, length, null, double, language, null, format]],
      ],
    ];
    return this._callGenerate(notebookId, params);
  }

  async createVideo(notebookId: string, opts: CreateVideoOptions = {}): Promise<GenerationStatus> {
    const format = opts.format ?? null;
    const style = opts.style ?? null;
    const language = opts.language ?? "en";
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const triple = tripleNest(sourceIds);
    const double = doubleNest(sourceIds);

    // config at index 8 (two extra nulls at 6,7)
    const params = [
      [2],
      notebookId,
      [
        null,
        null,
        ArtifactTypeCode.VIDEO,
        triple,
        null,
        null,
        null,
        null,
        [null, null, [double, language, opts.instructions ?? null, null, format, style]],
      ],
    ];
    return this._callGenerate(notebookId, params);
  }

  async createQuiz(notebookId: string, opts: CreateQuizOptions = {}): Promise<GenerationStatus> {
    const quantity = opts.quantity ?? null;
    const difficulty = opts.difficulty ?? null;
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const triple = tripleNest(sourceIds);

    // config at index 9 (three extra nulls at 6,7,8); no source_ids_double in config
    const params = [
      [2],
      notebookId,
      [
        null,
        null,
        ArtifactTypeCode.QUIZ,
        triple,
        null,
        null,
        null,
        null,
        null,
        [
          null,
          [2, null, opts.instructions ?? null, null, null, null, null, [quantity, difficulty]],
        ],
      ],
    ];
    return this._callGenerate(notebookId, params);
  }

  async createFlashcards(
    notebookId: string,
    opts: CreateQuizOptions = {},
  ): Promise<GenerationStatus> {
    const quantity = opts.quantity ?? null;
    const difficulty = opts.difficulty ?? null;
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const triple = tripleNest(sourceIds);

    // config at index 9; note [difficulty, quantity] order (reversed from quiz)
    const params = [
      [2],
      notebookId,
      [
        null,
        null,
        ArtifactTypeCode.QUIZ,
        triple,
        null,
        null,
        null,
        null,
        null,
        [null, [1, null, opts.instructions ?? null, null, null, null, [difficulty, quantity]]],
      ],
    ];
    return this._callGenerate(notebookId, params);
  }

  async createInfographic(
    notebookId: string,
    opts: CreateInfographicOptions = {},
  ): Promise<GenerationStatus> {
    const orientation = opts.orientation ?? null;
    const detail = opts.detail ?? null;
    const style = opts.style ?? null;
    const language = opts.language ?? "en";
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const triple = tripleNest(sourceIds);

    // config at index 14 (eight extra nulls at 6-13); no source_ids_double in config
    const params = [
      [2],
      notebookId,
      [
        null,
        null,
        ArtifactTypeCode.INFOGRAPHIC,
        triple,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [[opts.instructions ?? null, language, null, orientation, detail, style]],
      ],
    ];
    return this._callGenerate(notebookId, params);
  }

  async createSlideDeck(
    notebookId: string,
    opts: CreateSlideDeckOptions = {},
  ): Promise<GenerationStatus> {
    const format = opts.format ?? null;
    const length = opts.length ?? null;
    const language = opts.language ?? "en";
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const triple = tripleNest(sourceIds);

    // config at index 16 (ten extra nulls at 6-15); no source_ids_double in config
    const params = [
      [2],
      notebookId,
      [
        null,
        null,
        ArtifactTypeCode.SLIDE_DECK,
        triple,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [[opts.instructions ?? null, language, format, length]],
      ],
    ];
    return this._callGenerate(notebookId, params);
  }

  async createReport(
    notebookId: string,
    opts: CreateReportOptions = {},
  ): Promise<GenerationStatus> {
    const format = opts.format ?? "briefing_doc";
    const language = opts.language ?? "en";
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const triple = tripleNest(sourceIds);
    const double = doubleNest(sourceIds);

    const configs: Record<string, { title: string; description: string; prompt: string }> = {
      briefing_doc: {
        title: "Briefing Doc",
        description: "Key insights and important quotes",
        prompt:
          "Create a comprehensive briefing document that includes an Executive Summary, " +
          "detailed analysis of key themes, important quotes with context, and actionable insights.",
      },
      study_guide: {
        title: "Study Guide",
        description: "Short-answer quiz, essay questions, glossary",
        prompt:
          "Create a comprehensive study guide that includes key concepts, short-answer practice " +
          "questions, essay prompts for deeper exploration, and a glossary of important terms.",
      },
      blog_post: {
        title: "Blog Post",
        description: "Insightful takeaways in readable article format",
        prompt:
          "Write an engaging blog post that presents the key insights in an accessible, " +
          "reader-friendly format with an attention-grabbing introduction and compelling conclusion.",
      },
      custom: {
        title: "Custom Report",
        description: "Custom format",
        prompt: opts.customPrompt ?? "Create a report based on the provided sources.",
      },
    };

    const cfg = configs[format] ?? configs["briefing_doc"]!;
    const prompt =
      opts.extraInstructions && format !== "custom"
        ? `${cfg.prompt}\n\n${opts.extraInstructions}`
        : cfg.prompt;

    const params = [
      [2],
      notebookId,
      [
        null,
        null,
        ArtifactTypeCode.REPORT,
        triple,
        null,
        null,
        null,
        [null, [cfg.title, cfg.description, null, double, language, prompt, null, true]],
      ],
    ];
    return this._callGenerate(notebookId, params);
  }

  async createMindMap(notebookId: string, sourceIds?: string[]): Promise<GenerationStatus> {
    const ids = sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const triple = tripleNest(ids);

    // Mind map uses GENERATE_MIND_MAP RPC with a completely different param layout
    const params = [
      triple,
      null,
      null,
      null,
      null,
      ["interactive_mindmap", [["[CONTEXT]", ""]], ""],
      null,
      [2, null, [1]],
    ];
    const result = await this.rpc.call(RPCMethod.GENERATE_MIND_MAP, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return this._parseGenerationResult(result);
  }

  // ---------------------------------------------------------------------------
  // Polling / download
  // ---------------------------------------------------------------------------

  /** Poll until artifact reaches completed/failed status. */
  async waitUntilReady(
    notebookId: string,
    artifactId: string,
    timeout = 300,
    pollInterval = 3,
  ): Promise<Artifact> {
    const deadline = Date.now() + timeout * 1000;

    while (Date.now() < deadline) {
      const artifact = await this.get(notebookId, artifactId);
      if (artifact?.status === "completed") return artifact;
      if (artifact?.status === "failed") {
        throw new ArtifactNotReadyError(artifact.kind, { artifactId, status: "failed" });
      }
      await sleep(pollInterval * 1000);
    }
    throw new ArtifactNotReadyError("artifact", { artifactId, status: "timeout" });
  }

  /** Download audio content as a Buffer. */
  async downloadAudio(notebookId: string, artifactId: string): Promise<Buffer> {
    const artifact = await this.get(notebookId, artifactId);
    if (!artifact || artifact.status !== "completed") {
      throw new ArtifactNotReadyError("audio", { artifactId, status: artifact?.status });
    }
    if (!artifact.audioUrl) throw new ArtifactNotReadyError("audio", { artifactId });
    return this._fetchMediaWithCookies(artifact.audioUrl);
  }

  /** Download video content as a Buffer. */
  async downloadVideo(notebookId: string, artifactId: string): Promise<Buffer> {
    const artifact = await this.get(notebookId, artifactId);
    if (!artifact || artifact.status !== "completed") {
      throw new ArtifactNotReadyError("video", { artifactId, status: artifact?.status });
    }
    if (!artifact.videoUrl) throw new ArtifactNotReadyError("video", { artifactId });
    return this._fetchMediaWithCookies(artifact.videoUrl);
  }

  /** Get markdown content for a completed report artifact. */
  async getReportMarkdown(notebookId: string, artifactId: string): Promise<string | null> {
    const artifact = await this.get(notebookId, artifactId);
    return artifact?.content ?? null;
  }

  /** Get interactive HTML for quiz/flashcard artifacts. */
  async getInteractiveHtml(notebookId: string, artifactId: string): Promise<string | null> {
    const params = [artifactId];
    const result = await this.rpc.call(RPCMethod.GET_INTERACTIVE_HTML, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    // result[0] is artifact data array; HTML is at result[0][9][0]
    if (Array.isArray(result) && Array.isArray(result[0])) {
      const data = result[0] as unknown[];
      if (Array.isArray(data[9]) && typeof (data[9] as unknown[])[0] === "string") {
        return (data[9] as unknown[])[0] as string;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Fetch a Google-hosted media URL, manually following redirects to ensure
   * cookies are included on every hop. Node/Bun fetch strips the Cookie header
   * on cross-origin redirects (e.g. googleusercontent.com → lh3.google.com).
   */
  private async _fetchMediaWithCookies(url: string, maxRedirects = 10): Promise<Buffer> {
    let current = url;
    for (let i = 0; i < maxRedirects; i++) {
      if (!isTrustedDomain(current)) {
        throw new Error(`Untrusted redirect target: ${new URL(current).hostname}`);
      }
      const response = await fetch(current, {
        headers: { Cookie: this.auth.googleCookieHeader },
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location)
          throw new Error(`Redirect with no Location header (status ${response.status})`);
        current = location.startsWith("http") ? location : new URL(location, current).href;
        continue;
      }

      if (!response.ok) throw new Error(`Media download failed: HTTP ${response.status}`);

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        throw new Error("Media download returned HTML — authentication cookies may be expired.");
      }

      return Buffer.from(await response.arrayBuffer());
    }
    throw new Error("Too many redirects fetching media URL");
  }

  private async _callGenerate(notebookId: string, params: unknown[]): Promise<GenerationStatus> {
    const result = await this.rpc.call(RPCMethod.CREATE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return this._parseGenerationResult(result);
  }

  private _parseGenerationResult(result: unknown): GenerationStatus {
    if (Array.isArray(result) && result.length > 0) {
      const artifactData = result[0] as unknown[];
      const artifactId =
        Array.isArray(artifactData) &&
        artifactData.length > 0 &&
        typeof artifactData[0] === "string"
          ? (artifactData[0] as string)
          : null;
      const statusCode =
        Array.isArray(artifactData) &&
        artifactData.length > 4 &&
        typeof artifactData[4] === "number"
          ? (artifactData[4] as number)
          : null;

      if (artifactId) {
        return {
          artifactId,
          status: statusCode != null ? artifactStatusFromCode(statusCode) : "pending",
        };
      }
    }
    return { artifactId: null, status: "failed" };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TRUSTED_MEDIA_DOMAINS = [
  ".google.com",
  ".googleusercontent.com",
  ".googleapis.com",
  ".usercontent.google.com",
];

function isTrustedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return TRUSTED_MEDIA_DOMAINS.some((d) => host === d.slice(1) || host.endsWith(d));
  } catch {
    return false;
  }
}
