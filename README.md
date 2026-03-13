# notebooklm-sdk

A lightweight, zero-dependency TypeScript npm package for working with the NotebookLM API. Designed to work seamlessly across Node.js, Bun, and Deno.

## Installation

```bash
npm install notebooklm-sdk
# or
yarn add notebooklm-sdk
# or
pnpm add notebooklm-sdk
# or
bun add notebooklm-sdk
```

## Usage

For full, runnable scripts, check out the `examples/` directory in this repository.

### Basic Connection & Fetching

```typescript
import { NotebookLMClient } from "notebooklm-sdk";

// 1. You can pass a string or parsed JSON object (e.g., from Playwright)
const client = await NotebookLMClient.connect({
  cookies: process.env.NOTEBOOKLM_COOKIE,
});

// 2. Fetch notebooks
const notebooks = await client.notebooks.list();

// 3. Create artifacts (e.g. an Audio Podcast)
const audio = await client.artifacts.createAudio(notebooks[0].id);
```

## Examples

We provide runnable scripts in the [`examples/`](./examples) directory. 
Make sure you have an `.env` file with `NOTEBOOKLM_COOKIE` defined (it can be your raw cookie string or a Playwright `storage_state.json` array).

### 1. Basic Connection & Fetch 
A simple script that connects to NotebookLM, fetches all your notebooks, and lists the sources in the first notebook.

```bash
# Using bun
bunx dotenv -e .env -- bunx tsx examples/basic.ts

# Using npx
npx dotenv -e .env -- npx tsx examples/basic.ts
```

### 2. Generate and Download a Report
An end-to-end script that triggers the generation of a Summary Report, polls the API until it's ready, and downloads the interactive HTML to your disk.

```bash
# Using bun
bunx dotenv -e .env -- bunx tsx examples/report.ts

# Using npx
npx dotenv -e .env -- npx tsx examples/report.ts
```

## Structure

```
  src/
  ├── auth.ts              — Cookie loading, token fetching, connect()
  ├── client.ts            — NotebookLMClient (main entry point)
  ├── index.ts             — Public exports
  ├── rpc/
  │   ├── encoder.ts       — encodeRPCRequest, buildRequestBody, buildUrlParams
  │   ├── decoder.ts       — stripAntiXSSI, parseChunkedResponse, decodeResponse
  │   └── core.ts          — RPCCore (HTTP + decode pipeline)
  ├── api/
  │   ├── notebooks.ts     — list, create, get, delete, rename, getSummary, getDescription
  │   ├── sources.ts       — list, get, addUrl, addText, addFile, delete, waitUntilReady
  │   ├── artifacts.ts     — list, createAudio/Video/Quiz/Flashcards/Infographic/SlideDeck/Report, waitUntilReady, downloadAudio
  │   ├── chat.ts          — ask, getConversationTurns, getLastConversationId
  │   └── notes.ts         — list, create, update, delete
  └── types/
      ├── enums.ts         — All RPC method IDs, type codes, format options
      ├── errors.ts        — Full error hierarchy (NotebookLMError → all subtypes)
      └── models.ts        — All interfaces + parsers (parseNotebook, parseSource, parseArtifact, parseNote)
```

## Authentication

This package relies on **manual cookies only** for authentication. It does not include or require Playwright or any other headless browser automation to fetch sessions.

You must extract your authentication cookies manually and pass them into the SDK client.

## Features

- **Zero Runtime Dependencies**: Keeps your footprint tiny and fast.
- **Cross-Environment Compatibility**: Works out of the box with Node.js, Bun, and Deno.
- **Builds**: ESM & CJS support compiled via `tsup`.
- **Testing & Formatting**: Rigorously tested using `vitest` and formatted with `biome`.
- **Fully Typed RPC**: A complete RPC method ID table covering 30+ methods.
- **Documentation Built-In**: Enums, error types, and underlying HTTP details are fully documented.

## Development Architecture

If you intend to contribute or fork, note that the internal compilation and initialization flow is executed in the following order:

1. **Encoder**
2. **Decoder**
3. **Auth**
4. **RPC Core**
5. **API Modules**
6. **Publish**

## License

MIT
