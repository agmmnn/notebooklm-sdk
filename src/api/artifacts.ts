import {
  AudioFormat,
  AudioLength,
  ArtifactTypeCode,
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
  artifactStatusFromCode,
  artifactTypeFromCode,
} from "../types/enums.js";
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
import { ArtifactNotReadyError } from "../types/errors.js";
import { parseArtifact } from "../types/models.js";
import type { Artifact, GenerationStatus } from "../types/models.js";
import type { RPCCore } from "../rpc/core.js";
import type { AuthTokens } from "../auth.js";

export interface CreateAudioOptions {
  format?: AudioFormatValue;
  length?: AudioLengthValue;
  sourceIds?: string[];
  customPrompt?: string;
}

export interface CreateVideoOptions {
  format?: VideoFormatValue;
  style?: VideoStyleValue;
  sourceIds?: string[];
}

export interface CreateQuizOptions {
  quantity?: QuizQuantityValue;
  difficulty?: QuizDifficultyValue;
  sourceIds?: string[];
}

export interface CreateInfographicOptions {
  orientation?: InfographicOrientationValue;
  detail?: InfographicDetailValue;
  style?: InfographicStyleValue;
  sourceIds?: string[];
}

export interface CreateSlideDeckOptions {
  format?: SlideDeckFormatValue;
  length?: SlideDeckLengthValue;
  sourceIds?: string[];
}

export interface CreateReportOptions {
  title?: string;
  description?: string;
  prompt?: string;
  sourceIds?: string[];
}

export class ArtifactsAPI {
  constructor(
    private readonly rpc: RPCCore,
    private readonly auth: AuthTokens,
  ) {}

  async list(notebookId: string): Promise<Artifact[]> {
    const params = [notebookId, [2]];
    const result = await this.rpc.call(RPCMethod.LIST_ARTIFACTS, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    if (!Array.isArray(result)) return [];
    const artifacts: Artifact[] = [];

    for (const item of result as unknown[][]) {
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
    const params = [notebookId, artifactId, [2]];
    await this.rpc.call(RPCMethod.DELETE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return true;
  }

  async rename(notebookId: string, artifactId: string, newTitle: string): Promise<boolean> {
    const params = [notebookId, artifactId, newTitle, [2]];
    await this.rpc.call(RPCMethod.RENAME_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Generation helpers
  // ---------------------------------------------------------------------------

  async createAudio(notebookId: string, opts: CreateAudioOptions = {}): Promise<Artifact> {
    const format = opts.format ?? AudioFormat.DEEP_DIVE;
    const length = opts.length ?? AudioLength.DEFAULT;
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));

    const audioConfig = [format, null, length];
    const params = [notebookId, sourceIds, ArtifactTypeCode.AUDIO, audioConfig, null, null, [2]];

    const result = await this.rpc.call(RPCMethod.CREATE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    return this._parseCreationResult(result, notebookId);
  }

  async createVideo(notebookId: string, opts: CreateVideoOptions = {}): Promise<Artifact> {
    const format = opts.format ?? VideoFormat.EXPLAINER;
    const style = opts.style ?? VideoStyle.AUTO_SELECT;
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));

    const videoConfig = [format, style];
    const params = [notebookId, sourceIds, ArtifactTypeCode.VIDEO, videoConfig, null, null, [2]];

    const result = await this.rpc.call(RPCMethod.CREATE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    return this._parseCreationResult(result, notebookId);
  }

  async createQuiz(notebookId: string, opts: CreateQuizOptions = {}): Promise<Artifact> {
    const quantity = opts.quantity ?? QuizQuantity.STANDARD;
    const difficulty = opts.difficulty ?? QuizDifficulty.MEDIUM;
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const variant = 2; // QUIZ variant (1=flashcards, 2=quiz)

    const quizConfig = [variant, quantity, difficulty];
    const params = [notebookId, sourceIds, ArtifactTypeCode.QUIZ, quizConfig, null, null, [2]];

    const result = await this.rpc.call(RPCMethod.CREATE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    return this._parseCreationResult(result, notebookId);
  }

  async createFlashcards(notebookId: string, opts: CreateQuizOptions = {}): Promise<Artifact> {
    const quantity = opts.quantity ?? QuizQuantity.STANDARD;
    const difficulty = opts.difficulty ?? QuizDifficulty.MEDIUM;
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const variant = 1; // FLASHCARDS variant

    const config = [variant, quantity, difficulty];
    const params = [notebookId, sourceIds, ArtifactTypeCode.QUIZ, config, null, null, [2]];

    const result = await this.rpc.call(RPCMethod.CREATE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    return this._parseCreationResult(result, notebookId);
  }

  async createInfographic(
    notebookId: string,
    opts: CreateInfographicOptions = {},
  ): Promise<Artifact> {
    const orientation = opts.orientation ?? InfographicOrientation.LANDSCAPE;
    const detail = opts.detail ?? InfographicDetail.STANDARD;
    const style = opts.style ?? InfographicStyle.AUTO_SELECT;
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));

    const config = [orientation, detail, style];
    const params = [notebookId, sourceIds, ArtifactTypeCode.INFOGRAPHIC, config, null, null, [2]];

    const result = await this.rpc.call(RPCMethod.CREATE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    return this._parseCreationResult(result, notebookId);
  }

  async createSlideDeck(notebookId: string, opts: CreateSlideDeckOptions = {}): Promise<Artifact> {
    const format = opts.format ?? SlideDeckFormat.DETAILED_DECK;
    const length = opts.length ?? SlideDeckLength.DEFAULT;
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));

    const config = [format, length];
    const params = [notebookId, sourceIds, ArtifactTypeCode.SLIDE_DECK, config, null, null, [2]];

    const result = await this.rpc.call(RPCMethod.CREATE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    return this._parseCreationResult(result, notebookId);
  }

  async createReport(notebookId: string, opts: CreateReportOptions = {}): Promise<Artifact> {
    const sourceIds = opts.sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const config = [opts.title ?? null, opts.description ?? null, opts.prompt ?? null];

    const params = [notebookId, sourceIds, ArtifactTypeCode.REPORT, config, null, null, [2]];

    const result = await this.rpc.call(RPCMethod.CREATE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    return this._parseCreationResult(result, notebookId);
  }

  async createMindMap(notebookId: string, sourceIds?: string[]): Promise<Artifact> {
    const ids = sourceIds ?? (await this.rpc.getSourceIds(notebookId));
    const params = [notebookId, ids, ArtifactTypeCode.MIND_MAP, null, null, null, [2]];

    const result = await this.rpc.call(RPCMethod.CREATE_ARTIFACT, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    return this._parseCreationResult(result, notebookId);
  }

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
        throw new ArtifactNotReadyError(artifact.kind, {
          artifactId,
          status: "failed",
        });
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
    if (!artifact.audioUrl) {
      throw new ArtifactNotReadyError("audio", { artifactId });
    }

    const response = await fetch(artifact.audioUrl, {
      headers: { Cookie: this.auth.cookieHeader },
    });
    if (!response.ok) {
      throw new Error(`Audio download failed: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Get interactive HTML for quiz/flashcards artifacts. */
  async getInteractiveHtml(notebookId: string, artifactId: string): Promise<string> {
    const params = [notebookId, artifactId, [2]];
    const result = await this.rpc.call(RPCMethod.GET_INTERACTIVE_HTML, params, {
      sourcePath: `/notebook/${notebookId}`,
    });
    if (typeof result === "string") return result;
    if (Array.isArray(result) && typeof result[0] === "string") return result[0] as string;
    return "";
  }

  private _parseCreationResult(result: unknown, notebookId: string): Artifact {
    if (Array.isArray(result) && result.length > 0) {
      const first = result[0];
      if (Array.isArray(first)) {
        return parseArtifact(first as unknown[], notebookId);
      }
      return parseArtifact(result as unknown[], notebookId);
    }
    throw new Error("Could not parse artifact creation response");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
