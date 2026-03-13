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

```typescript
const client = await NotebookLMClient.connect({
  cookies: process.env.NOTEBOOKLM_COOKIES,
});

const notebooks = await client.notebooks.list();

const audio = await client.artifacts.createAudio(notebookId);
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
