# notebooklm-sdk

## 0.3.1

### Patch Changes

- 6979caf: feat: add sources.addDrive, chat.configure, and artifact list helpers

  - `sources.addDrive(notebookId, fileId, title, mimeType?)` — add a Google Drive file as a source; new `DriveMimeType` enum
  - `chat.configure(notebookId, goal, length, customPrompt?)` — low-level chat config with new `ChatGoal` and `ChatResponseLength` enums
  - `artifacts.listAudio/Video/Reports/Quizzes/Flashcards/Infographics/SlideDecks/DataTables` — type-filtered list helpers

## 0.3.0

### Minor Changes

- 1d13d40: Add 7 new API methods reaching parity with the Python SDK

  **New artifact methods:**

  - `artifacts.reviseSlide(notebookId, artifactId, slideIndex, prompt)` — edit an individual slide in a completed slide deck
  - `artifacts.suggestReports(notebookId)` — get AI-suggested report formats based on notebook content

  **New source methods:**

  - `sources.getGuide(notebookId, sourceId)` — get the AI-generated Source Guide (summary + keywords)
  - `sources.getFulltext(notebookId, sourceId)` — get the full indexed text content of a source
  - `sources.checkFreshness(notebookId, sourceId)` — check if a URL source has newer content available

  **New notebook method:**

  - `notebooks.removeFromRecent(notebookId)` — remove a notebook from the recently viewed list

  **New chat method:**

  - `chat.setMode(notebookId, mode)` — set chat response style with `ChatMode` enum (`DEFAULT`, `CONCISE`, `DETAILED`, `LEARNING_GUIDE`)

  **New exported types:** `ReportSuggestion`, `SourceGuide`, `SourceFulltext` (expanded), `ChatMode`, `ChatModeValue`

## 0.2.0

### Minor Changes

- **Notes & Mind Map overhaul — correct RPC params, new methods, bug fixes**

  ### New features

  - `client.notes.list(notebookId)` — list user-created text notes (mind maps excluded)
  - `client.notes.listMindMaps(notebookId)` — list AI-generated mind maps saved in the notebook
  - `client.artifacts.createMindMap(notebookId, sourceIds?)` — generate a mind map synchronously; saves it as a note and returns the `Note`
  - Slide deck, infographic, and data table artifact downloads (`downloadSlideDeck`, `downloadInfographic`, `getDataTableContent`)
  - `.vscode/settings.json` — Biome auto-format on save for the project

  ### Bug fixes

  - Fixed `GET_NOTES_AND_MIND_MAPS` RPC params — removed spurious `[2]` trailer that caused null responses
  - Fixed `CREATE_NOTE` RPC params — Google ignores content/title on create; now creates empty note then calls `UPDATE_NOTE` to set content and title
  - Fixed `UPDATE_NOTE` RPC params — correct nested format `[notebookId, noteId, [[[content, title, [], 0]]]]`
  - Fixed `DELETE_NOTE` RPC params — correct format `[notebookId, null, [noteId]]`
  - Fixed note/mind map title parsing — title is at `item[1][4]` in the new API response format, not `item[2]`
  - Fixed mind map generation — `GENERATE_MIND_MAP` RPC returns content synchronously (does not persist); content is now extracted from `result[0][0]` and saved explicitly
  - Fixed lint warning in `research.ts` — replaced non-null assertion with type-safe filter

  ### Breaking changes

  - `client.notes.list()` now returns `Note[]` instead of `{ notes, mindMaps }` — use `listMindMaps()` for mind maps
  - `MindMap` type removed — mind maps are now represented as `Note` objects
  - `client.notes.getMindMapContent()` removed — use `listMindMaps()` and `JSON.parse(note.content)` directly
  - `client.artifacts.createMindMap()` now returns `Note` instead of `GenerationStatus`
