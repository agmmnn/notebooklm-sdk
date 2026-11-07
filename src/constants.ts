/** Current NotebookLM origin. All API, auth, and share URLs are derived from this. */
export const NOTEBOOKLM_ORIGIN = "https://notebook.google.com";

/** Hostname of {@link NOTEBOOKLM_ORIGIN}. */
export const NOTEBOOKLM_HOST = new URL(NOTEBOOKLM_ORIGIN).hostname;

/** Pre-migration hostname. Still accepted when loading session cookies. */
export const NOTEBOOKLM_LEGACY_HOST = "notebooklm.google.com";
