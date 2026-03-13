import type {
  ArtifactStatus,
  ArtifactType,
  SourceStatus,
  SourceType,
  artifactStatusFromCode,
  artifactTypeFromCode,
  sourceStatusFromCode,
  sourceTypeFromCode,
} from "./enums.js";

export type { ArtifactStatus, ArtifactType, SourceStatus, SourceType };

// ---------------------------------------------------------------------------
// Notebook
// ---------------------------------------------------------------------------

export interface Notebook {
  id: string;
  title: string;
  createdAt: Date | null;
  sourcesCount: number;
  isOwner: boolean;
}

export interface SuggestedTopic {
  question: string;
  prompt: string;
}

export interface NotebookDescription {
  summary: string;
  suggestedTopics: SuggestedTopic[];
}

export interface SourceSummary {
  kind: SourceType;
  title: string | null;
  url: string | null;
}

export interface NotebookMetadata {
  id: string;
  title: string;
  createdAt: Date | null;
  isOwner: boolean;
  sources: SourceSummary[];
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export interface Source {
  id: string;
  title: string | null;
  url: string | null;
  kind: SourceType;
  createdAt: Date | null;
  status: SourceStatus;
  /** Raw type code from API (for debugging) */
  _typeCode: number | null;
}

export interface SourceFulltext {
  sourceId: string;
  text: string;
}

export interface SourceSummaryData {
  sourceId: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Artifact
// ---------------------------------------------------------------------------

export interface Artifact {
  id: string;
  title: string | null;
  kind: ArtifactType;
  status: ArtifactStatus;
  notebookId: string;
  audioUrl: string | null;
  exportUrl: string | null;
  shareUrl: string | null;
  /** Raw data from API */
  _raw: unknown[];
}

export interface GenerationStatus {
  status: ArtifactStatus;
  artifactId: string | null;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatReference {
  sourceId: string;
  title: string | null;
  url: string | null;
}

export interface AskResult {
  answer: string;
  conversationId: string;
  turnNumber: number;
  references: ChatReference[];
}

export interface ConversationTurn {
  query: string;
  answer: string;
  turnNumber: number;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export interface Note {
  id: string;
  title: string | null;
  content: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MindMap {
  id: string;
  title: string | null;
  content: string;
  createdAt: Date | null;
}

// ---------------------------------------------------------------------------
// Parsers (from raw API responses)
// ---------------------------------------------------------------------------

import {
  artifactStatusFromCode as _artifactStatusFromCode,
  artifactTypeFromCode as _artifactTypeFromCode,
  sourceStatusFromCode as _sourceStatusFromCode,
  sourceTypeFromCode as _sourceTypeFromCode,
} from "./enums.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export function parseNotebook(data: Raw[]): Notebook {
  const rawTitle = typeof data[0] === "string" ? data[0] : "";
  const title = rawTitle.replace("thought\n", "").trim();
  const id = typeof data[2] === "string" ? data[2] : "";

  let createdAt: Date | null = null;
  if (Array.isArray(data[5]) && Array.isArray(data[5][5]) && data[5][5].length > 0) {
    try {
      createdAt = new Date((data[5][5][0] as number) * 1000);
    } catch {
      // ignore
    }
  }

  const isOwner = !(Array.isArray(data[5]) && data[5][1] === true);

  return { id, title, createdAt, sourcesCount: 0, isOwner };
}

export function parseSource(src: Raw[]): Source {
  const srcId = Array.isArray(src[0]) ? (src[0][0] as string) : (src[0] as string);
  const title = typeof src[1] === "string" ? src[1] : null;

  let url: string | null = null;
  if (Array.isArray(src[2]) && Array.isArray(src[2][7]) && src[2][7].length > 0) {
    url = typeof src[2][7][0] === "string" ? (src[2][7][0] as string) : null;
  }

  let createdAt: Date | null = null;
  if (Array.isArray(src[2]) && Array.isArray(src[2][2]) && typeof src[2][2][0] === "number") {
    try {
      createdAt = new Date((src[2][2][0] as number) * 1000);
    } catch {
      // ignore
    }
  }

  let statusCode = 2; // default READY
  if (Array.isArray(src[3]) && typeof src[3][1] === "number") {
    statusCode = src[3][1] as number;
  }

  let typeCode: number | null = null;
  if (Array.isArray(src[2]) && typeof src[2][4] === "number") {
    typeCode = src[2][4] as number;
  }

  return {
    id: String(srcId),
    title,
    url,
    kind: _sourceTypeFromCode(typeCode),
    createdAt,
    status: _sourceStatusFromCode(statusCode),
    _typeCode: typeCode,
  };
}

export function parseArtifact(data: Raw[], notebookId: string): Artifact {
  const id = typeof data[0] === "string" ? data[0] : "";
  const title = typeof data[1] === "string" ? data[1] : null;
  const typeCode = typeof data[2] === "number" ? (data[2] as number) : 0;
  const variant = typeof data[3] === "number" ? (data[3] as number) : null;
  const statusCode = typeof data[4] === "number" ? (data[4] as number) : 0;

  // Audio URL at data[6][0] (when available)
  let audioUrl: string | null = null;
  if (Array.isArray(data[6]) && typeof data[6][0] === "string") {
    audioUrl = data[6][0] as string;
  }

  return {
    id,
    title,
    kind: _artifactTypeFromCode(typeCode, variant),
    status: _artifactStatusFromCode(statusCode),
    notebookId,
    audioUrl,
    exportUrl: null,
    shareUrl: null,
    _raw: Array.isArray(data) ? data : [],
  };
}

export function parseNote(data: Raw[]): Note {
  const id = typeof data[0] === "string" ? data[0] : "";
  const content = typeof data[1] === "string" ? data[1] : "";
  const title = typeof data[2] === "string" ? data[2] : null;

  let createdAt: Date | null = null;
  let updatedAt: Date | null = null;
  if (Array.isArray(data[3]) && typeof data[3][0] === "number") {
    try {
      createdAt = new Date((data[3][0] as number) * 1000);
    } catch {
      // ignore
    }
  }
  if (Array.isArray(data[4]) && typeof data[4][0] === "number") {
    try {
      updatedAt = new Date((data[4][0] as number) * 1000);
    } catch {
      // ignore
    }
  }

  return { id, title, content, createdAt, updatedAt };
}
