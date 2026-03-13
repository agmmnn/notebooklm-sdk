# notebooklm-sdk

A lightweight, zero-dependency TypeScript SDK for the NotebookLM API. Works with Node.js, Bun, and Deno.

## Installation

```bash
npm install notebooklm-sdk
# or
bun add notebooklm-sdk
```

## Authentication

This SDK uses **manual cookie auth only** — no Playwright, no headless browser. You extract your cookies once and pass them in.

**Option 1 — Raw cookie string** (from browser DevTools → Network tab → copy `Cookie` request header):
```bash
NOTEBOOKLM_COOKIE="SID=...; HSID=...; ..."
```

**Option 2 — Playwright `storage_state.json`** (JSON array of cookie objects):
```bash
NOTEBOOKLM_COOKIE='[{"name":"SID","value":"...","domain":".google.com",...}]'
```

Then connect:
```typescript
import { NotebookLMClient } from "notebooklm-sdk";

const client = await NotebookLMClient.connect({
  cookies: process.env.NOTEBOOKLM_COOKIE,
});
```

## API Reference

### Notebooks

```typescript
const notebooks = await client.notebooks.list();
const nb = await client.notebooks.get(notebookId);
const { notebookId } = await client.notebooks.create("My Notebook");
await client.notebooks.rename(notebookId, "New Title");
await client.notebooks.delete(notebookId);

const summary = await client.notebooks.getSummary(notebookId);
const description = await client.notebooks.getDescription(notebookId);
// description.summary, description.suggestedTopics
```

### Sources

```typescript
const sources = await client.sources.list(notebookId);
const source = await client.sources.get(notebookId, sourceId);

// Add sources
const { sourceId } = await client.sources.addUrl(notebookId, "https://example.com");
const { sourceId } = await client.sources.addText(notebookId, "My text", "My Title");
const { sourceId } = await client.sources.addFile(notebookId, buffer, "file.pdf");

// Poll until ready (status: "ready")
const source = await client.sources.waitUntilReady(notebookId, sourceId);

await client.sources.delete(notebookId, sourceId);
```

### Artifacts

Generate AI artifacts from notebook sources:

```typescript
// Audio podcast
const { artifactId } = await client.artifacts.createAudio(notebookId, {
  format: AudioFormat.DEEP_DIVE,  // DEEP_DIVE | BRIEF | CRITIQUE | DEBATE
  length: AudioLength.DEFAULT,    // SHORT | DEFAULT | LONG
  language: "en",
});

// Video
const { artifactId } = await client.artifacts.createVideo(notebookId, {
  format: VideoFormat.EXPLAINER,  // EXPLAINER | BRIEF | CINEMATIC
});

// Quiz / Flashcards
const { artifactId } = await client.artifacts.createQuiz(notebookId, {
  difficulty: QuizDifficulty.MEDIUM,
  quantity: QuizQuantity.STANDARD,
});
const { artifactId } = await client.artifacts.createFlashcards(notebookId);

// Report (markdown)
const { artifactId } = await client.artifacts.createReport(notebookId, {
  format: "briefing_doc",  // "briefing_doc" | "study_guide" | "blog_post" | "custom"
  language: "en",
});

// Other artifact types
await client.artifacts.createInfographic(notebookId);
await client.artifacts.createSlideDeck(notebookId);
await client.artifacts.createMindMap(notebookId);
```

Poll and download:

```typescript
// Wait until ready
const artifact = await client.artifacts.waitUntilReady(notebookId, artifactId);

// Download
const audioBuffer = await client.artifacts.downloadAudio(notebookId, artifactId);
const videoBuffer = await client.artifacts.downloadVideo(notebookId, artifactId);
const markdown = await client.artifacts.getReportMarkdown(notebookId, artifactId);
const html = await client.artifacts.getInteractiveHtml(notebookId, artifactId); // quiz/flashcards
```

### Chat

```typescript
// Ask a question
const result = await client.chat.ask(notebookId, "What is this about?");
console.log(result.answer);
console.log(result.references); // [{ sourceId, title, url }]

// Follow-up (pass conversationId to continue the thread)
const result2 = await client.chat.ask(notebookId, "Tell me more.", {
  conversationId: result.conversationId,
});

// Fetch conversation history
const lastConvId = await client.chat.getLastConversationId(notebookId);
const turns = await client.chat.getConversationTurns(notebookId, lastConvId);
```

### Notes

```typescript
const { notes, mindMaps } = await client.notes.list(notebookId);

const { noteId } = await client.notes.create(notebookId, "# My Note\n\nContent here.");
await client.notes.update(notebookId, noteId, "Updated content.");
await client.notes.delete(notebookId, noteId);
```

### Sharing

```typescript
const status = await client.sharing.getStatus(notebookId);
// status.isPublic, status.sharedUsers, status.shareUrl

// Enable/disable public link sharing
await client.sharing.setPublic(notebookId, true);

// Share with a specific user
await client.sharing.addUser(notebookId, "user@example.com", SharePermission.VIEWER);
await client.sharing.updateUser(notebookId, "user@example.com", SharePermission.EDITOR);
await client.sharing.removeUser(notebookId, "user@example.com");
```

### Settings

```typescript
const lang = await client.settings.getOutputLanguage(); // "en"
await client.settings.setOutputLanguage("ja");
```

## Examples

Runnable scripts in [`examples/`](./examples). Requires `.env` with `NOTEBOOKLM_COOKIE`.

| Script | What it does |
|--------|-------------|
| `basic.ts` | List notebooks and sources |
| `report.ts` | Generate and download a report |
| `audio.ts` | Generate a podcast (long wait) |
| `download.ts` | Download all completed artifacts (audio, video, reports, quiz, flashcards) |
| `chat.ts` | Ask questions and follow up |
| `settings.ts` | Check output language and sharing status |

```bash
bunx dotenv -e .env -- bunx tsx examples/basic.ts
```

## Error Handling

All errors extend `NotebookLMError`:

```typescript
import { ArtifactNotReadyError, AuthError, RateLimitError } from "notebooklm-sdk";

try {
  await client.artifacts.downloadAudio(notebookId, artifactId);
} catch (err) {
  if (err instanceof ArtifactNotReadyError) { /* artifact still processing */ }
  if (err instanceof AuthError) { /* cookies expired */ }
  if (err instanceof RateLimitError) { /* back off */ }
}
```

Error classes: `AuthError`, `RateLimitError`, `NetworkError`, `ServerError`, `RPCError`, `RPCTimeoutError`, `ArtifactNotReadyError`, `ArtifactNotFoundError`, `SourceAddError`, `SourceProcessingError`, `SourceTimeoutError`, and more.

## Project Structure

```
src/
├── client.ts          — NotebookLMClient
├── auth.ts            — Cookie auth, token fetching
├── index.ts           — Public exports
├── api/
│   ├── artifacts.ts   — Audio, video, quiz, report, slide deck, infographic, mind map
│   ├── chat.ts        — Chat / Q&A
│   ├── notebooks.ts   — CRUD + summary
│   ├── notes.ts       — Notes + mind maps
│   ├── settings.ts    — User settings
│   ├── sharing.ts     — Notebook sharing
│   └── sources.ts     — URL, text, file sources
├── rpc/
│   ├── core.ts        — HTTP + decode pipeline
│   ├── encoder.ts     — Request encoding
│   └── decoder.ts     — Response decoding
└── types/
    ├── enums.ts       — RPC method IDs, format options, status codes
    ├── errors.ts      — Error hierarchy
    └── models.ts      — Interfaces + response parsers
```

## License

MIT
