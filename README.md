# notebooklm-sdk

[![npm version](https://img.shields.io/npm/v/notebooklm-sdk?style=flat-square)](https://www.npmjs.com/package/notebooklm-sdk)
![types](https://img.shields.io/npm/types/notebooklm-sdk?style=flat-square)
![license](https://img.shields.io/npm/l/notebooklm-sdk?style=flat-square)

A lightweight, zero-dependency TypeScript SDK for the NotebookLM API.  
Works in **Node.js, Bun, and Deno**.

> This SDK is a TypeScript port of [notebooklm-py](https://github.com/teng-lin/notebooklm-py).

---

## Installation

```bash
npm install notebooklm-sdk
# or
bun add notebooklm-sdk
```

## Authentication

### Quick Login (Recommended)

Run the built-in login script:

```bash
bun run login
```

This opens a real browser for Google sign-in and generates a
`storage_state.json` file you can reuse.

Then connect using the file:

```ts
import { NotebookLMClient } from "notebooklm-sdk";

const client = await NotebookLMClient.connect({
  cookiesFile: "./storage_state.json",
});
```

Requires:

```bash
bun add -d playwright
bunx playwright install chromium
```

<details>
<summary>Manual Authentication</summary>

You can authenticate in multiple ways depending on your setup.

#### 1. Use `.env` Cookie String

Copy the `Cookie` header from DevTools → Network and store it:

```bash
NOTEBOOKLM_COOKIE="SID=...; HSID=..."
```

Then:

```ts
const client = await NotebookLMClient.connect({
  cookies: process.env.NOTEBOOKLM_COOKIE,
});
```

---

#### 2. Use Playwright `storage_state.json`

If you already have a Playwright storage file:

```ts
const client = await NotebookLMClient.connect({
  cookiesFile: "./storage_state.json",
});
```

---

#### 3. Pass Cookies Directly

You can also pass cookies at runtime:

```ts
const client = await NotebookLMClient.connect({
  cookies: "SID=...; HSID=...",
});
```

</details>

---

## Notebooks

```ts
const notebooks = await client.notebooks.list();
const nb = await client.notebooks.get(id);

const { id: newId } = await client.notebooks.create("My Notebook");

await client.notebooks.rename(newId, "New Title");
await client.notebooks.delete(newId);

const summary = await client.notebooks.getSummary(id);
const description = await client.notebooks.getDescription(id);
```

---

## Sources

```ts
const sources = await client.sources.list(notebookId);

const { sourceId } = await client.sources.addUrl(
  notebookId,
  "https://example.com",
);
const { sourceId } = await client.sources.addText(notebookId, "Text", "Title");
const { sourceId } = await client.sources.addFile(
  notebookId,
  buffer,
  "file.pdf",
);

await client.sources.waitUntilReady(notebookId, sourceId);

await client.sources.delete(notebookId, sourceId);
```

---

## Artifacts

Generate AI outputs from notebook sources.

```ts
const { artifactId } = await client.artifacts.createAudio(notebookId, {
  format: AudioFormat.DEEP_DIVE,
  length: AudioLength.DEFAULT,
  language: "en",
});

const { artifactId } = await client.artifacts.createVideo(notebookId, {
  format: VideoFormat.EXPLAINER,
});

const { artifactId } = await client.artifacts.createQuiz(notebookId);
const { artifactId } = await client.artifacts.createFlashcards(notebookId);

const { artifactId } = await client.artifacts.createReport(notebookId, {
  format: "briefing_doc",
});
```

Wait & download:

```ts
await client.artifacts.waitUntilReady(notebookId, artifactId);

const audio = await client.artifacts.downloadAudio(notebookId, artifactId);
const video = await client.artifacts.downloadVideo(notebookId, artifactId);

const markdown = await client.artifacts.getReportMarkdown(
  notebookId,
  artifactId,
);
const html = await client.artifacts.getInteractiveHtml(notebookId, artifactId);
```

---

## Chat

```ts
const res = await client.chat.ask(notebookId, "What is this about?");
console.log(res.answer);

const follow = await client.chat.ask(notebookId, "Tell me more.", {
  conversationId: res.conversationId,
});

const convId = await client.chat.getLastConversationId(notebookId);
const turns = await client.chat.getConversationTurns(notebookId, convId);
```

---

## Notes

```ts
const { noteId } = await client.notes.create(notebookId, "# My Note");

await client.notes.update(notebookId, noteId, "Updated");
await client.notes.delete(notebookId, noteId);
```

---

## Research

```ts
const task = await client.research.start(
  notebookId,
  "Latest advances in quantum computing",
  "web",
  "deep",
);

const result = await client.research.poll(notebookId);

if (result.status === "completed") {
  await client.research.importSources(
    notebookId,
    result.taskId,
    result.sources.slice(0, 2),
  );
}
```

---

## Sharing

```ts
await client.sharing.setPublic(notebookId, true);

await client.sharing.addUser(
  notebookId,
  "user@example.com",
  SharePermission.VIEWER,
);
```

---

## Settings

```ts
const lang = await client.settings.getOutputLanguage();
await client.settings.setOutputLanguage("ja");
```

---

## Examples

Runnable scripts are in [`examples/`](./examples).

Requires `.env`:

```
NOTEBOOKLM_COOKIE=...
```

Run:

```bash
# for auto login
bun run login
bun run examples/basic.ts

# for manual cookie
bunx dotenv -e .env -- bunx tsx examples/basic.ts
```

---

## Error Handling

All errors extend `NotebookLMError`.

```ts
try {
  await client.artifacts.downloadAudio(notebookId, artifactId);
} catch (err) {
  if (err instanceof ArtifactNotReadyError) {
    // still processing
  }
}
```

---

## Project Structure

```
src/
  client.ts
  auth.ts
  api/
  rpc/
  types/
```

---

## License

MIT
