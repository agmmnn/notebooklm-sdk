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
  videoUrl: string | null;
  exportUrl: string | null;
  shareUrl: string | null;
  /** Markdown content for report artifacts (data[7][0]) */
  content: string | null;
  /** Raw data from API */
  _raw: unknown[];
}

export interface GenerationStatus {
  status: ArtifactStatus;
  artifactId: string | null;
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export interface SharedUser {
  email: string;
  permission: "owner" | "editor" | "viewer";
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ShareStatus {
  notebookId: string;
  isPublic: boolean;
  /** 0 = restricted, 1 = anyone with link */
  access: number;
  /** 0 = full notebook, 1 = chat only */
  viewLevel: number;
  sharedUsers: SharedUser[];
  shareUrl: string | null;
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
  const statusCode = typeof data[4] === "number" ? (data[4] as number) : 0;

  // Quiz/flashcard variant is at data[9][1][0]: 1=flashcards, 2=quiz
  let variant: number | null = null;
  if (
    typeCode === 4 &&
    Array.isArray(data[9]) &&
    Array.isArray(data[9][1]) &&
    typeof data[9][1][0] === "number"
  ) {
    variant = data[9][1][0] as number;
  }

  // Audio URL at data[6][5]: list of [url, ..., mime_type] media items
  let audioUrl: string | null = null;
  const meta6 = data[6];
  if (Array.isArray(meta6) && Array.isArray(meta6[5])) {
    const mediaList = meta6[5] as unknown[][];
    // Prefer audio/mp4 item; fallback to first item
    for (const item of mediaList) {
      if (Array.isArray(item) && item[2] === "audio/mp4" && typeof item[0] === "string") {
        audioUrl = item[0] as string;
        break;
      }
    }
    if (!audioUrl && Array.isArray(mediaList[0]) && typeof mediaList[0][0] === "string") {
      audioUrl = mediaList[0][0] as string;
    }
  }

  // Video URL at data[8]: scan for nested list with HTTP items, prefer video/mp4 priority 4
  let videoUrl: string | null = null;
  if (Array.isArray(data[8])) {
    const meta8 = data[8] as unknown[][];
    for (const item of meta8) {
      if (
        Array.isArray(item) &&
        Array.isArray(item[0]) &&
        typeof (item[0] as unknown[])[0] === "string" &&
        ((item[0] as unknown[])[0] as string).startsWith("http")
      ) {
        const mediaList = item as unknown[][];
        let best: string | null = null;
        for (const m of mediaList) {
          if (Array.isArray(m) && m[2] === "video/mp4" && typeof m[0] === "string") {
            best = m[0] as string;
            if (m[1] === 4) break;
          }
        }
        videoUrl =
          best ??
          (Array.isArray(mediaList[0]) && typeof mediaList[0][0] === "string"
            ? (mediaList[0][0] as string)
            : null);
        break;
      }
    }
  }

  // Report markdown content at data[7] or data[7][0]
  let content: string | null = null;
  if (Array.isArray(data[7]) && typeof data[7][0] === "string") {
    content = data[7][0] as string;
  } else if (typeof data[7] === "string") {
    content = data[7] as string;
  }

  return {
    id,
    title,
    kind: _artifactTypeFromCode(typeCode, variant),
    status: _artifactStatusFromCode(statusCode),
    notebookId,
    audioUrl,
    videoUrl,
    exportUrl: null,
    shareUrl: null,
    content,
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
