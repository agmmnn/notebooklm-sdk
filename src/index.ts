// Main client
export { NotebookLMClient } from "./client.js";
export type { ClientOptions } from "./client.js";

// Auth
export { connect } from "./auth.js";
export type { AuthTokens, ConnectOptions, CookieMap } from "./auth.js";

// Types / models
export type {
  Artifact,
  ArtifactStatus,
  ArtifactType,
  AskResult,
  ChatReference,
  ConversationTurn,
  GenerationStatus,
  MindMap,
  Note,
  Notebook,
  NotebookDescription,
  NotebookMetadata,
  ShareStatus,
  SharedUser,
  Source,
  SourceStatus,
  SourceSummary,
  SourceType,
  SuggestedTopic,
} from "./types/models.js";

// Enums (const objects)
export {
  AudioFormat,
  AudioLength,
  ArtifactTypeCode,
  ExportType,
  InfographicDetail,
  InfographicOrientation,
  InfographicStyle,
  QuizDifficulty,
  QuizQuantity,
  RPCMethod,
  ShareAccess,
  SharePermission,
  ShareViewLevel,
  SlideDeckFormat,
  SlideDeckLength,
  VideoFormat,
  VideoStyle,
} from "./types/enums.js";

export type {
  AudioFormatValue,
  AudioLengthValue,
  ExportTypeValue,
  InfographicDetailValue,
  InfographicOrientationValue,
  InfographicStyleValue,
  QuizDifficultyValue,
  QuizQuantityValue,
  RPCMethodId,
  ShareAccessValue,
  SharePermissionValue,
  ShareViewLevelValue,
  SlideDeckFormatValue,
  SlideDeckLengthValue,
  VideoFormatValue,
  VideoStyleValue,
} from "./types/enums.js";

// Errors
export {
  ArtifactDownloadError,
  ArtifactError,
  ArtifactNotFoundError,
  ArtifactNotReadyError,
  ArtifactParseError,
  AuthError,
  ChatError,
  ClientError,
  NetworkError,
  NotebookError,
  NotebookLMError,
  NotebookNotFoundError,
  RPCError,
  RPCTimeoutError,
  RateLimitError,
  ServerError,
  SourceAddError,
  SourceError,
  SourceNotFoundError,
  SourceProcessingError,
  SourceTimeoutError,
} from "./types/errors.js";

// API classes (for advanced users)
export { ArtifactsAPI } from "./api/artifacts.js";
export { ChatAPI } from "./api/chat.js";
export { NotebooksAPI } from "./api/notebooks.js";
export { NotesAPI } from "./api/notes.js";
export { ResearchAPI } from "./api/research.js";
export { SettingsAPI } from "./api/settings.js";
export { SharingAPI } from "./api/sharing.js";
export { SourcesAPI } from "./api/sources.js";

// API option types
export type {
  CreateAudioOptions,
  CreateVideoOptions,
  CreateQuizOptions,
  CreateInfographicOptions,
  CreateSlideDeckOptions,
  CreateReportOptions,
} from "./api/artifacts.js";
export type { AskOptions } from "./api/chat.js";
export type {
  ResearchTask,
  ResearchResult,
  ResearchSource,
  ImportedSource,
} from "./api/research.js";
export type { AddSourceOptions } from "./api/sources.js";
