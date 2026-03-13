/**
 * download.ts — List all artifacts in a notebook and download completed ones.
 *
 * Downloads:
 *   - Audio artifacts → downloads/<id>.mp4
 *   - Video artifacts → downloads/<id>.mp4
 *   - Report artifacts → downloads/<id>.md
 *   - Quiz/flashcard artifacts → downloads/<id>.html
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NotebookLMClient } from "../src/index.js";
import type { Artifact } from "../src/types/models.js";

async function main() {
  const cookieVar = process.env.NOTEBOOKLM_COOKIE || process.env.NOTEBOOKLM_COOKIES;
  if (!cookieVar) {
    console.error("❌ Please set NOTEBOOKLM_COOKIE in your .env file.");
    process.exit(1);
  }

  const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });

  const opts = cookieVar.trim().startsWith("{")
    ? { cookiesObject: JSON.parse(cookieVar) }
    : { cookies: cookieVar };

  const client = await NotebookLMClient.connect(opts);
  console.log("✅ Connected\n");

  const notebooks = await client.notebooks.list();
  if (!notebooks.length) {
    console.error("❌ No notebooks found.");
    process.exit(1);
  }

  const nb = notebooks[0];
  console.log(`📓 Notebook: [${nb.id}] ${nb.title}\n`);

  const artifacts = await client.artifacts.list(nb.id);
  console.log(`Found ${artifacts.length} artifact(s):\n`);

  // Print summary table
  for (const a of artifacts) {
    const downloadable = isDownloadable(a) ? "⬇️ " : "   ";
    console.log(
      `  ${downloadable}[${a.kind.padEnd(12)}] ${a.status.padEnd(12)} ${a.id}  ${a.title ?? ""}`,
    );
  }
  console.log();

  const completed = artifacts.filter((a) => a.status === "completed");
  const downloadable = completed.filter(isDownloadable);

  if (!downloadable.length) {
    console.log("No downloadable completed artifacts found.");
    return;
  }

  console.log(`Downloading ${downloadable.length} artifact(s)...\n`);

  for (const a of downloadable) {
    try {
      if (a.kind === "audio") {
        await downloadAudio(client, a, DOWNLOAD_DIR);
      } else if (a.kind === "video") {
        await downloadVideo(client, a, DOWNLOAD_DIR);
      } else if (a.kind === "report") {
        await downloadReport(client, a, DOWNLOAD_DIR);
      } else if (a.kind === "quiz" || a.kind === "flashcards") {
        await downloadInteractive(client, a, DOWNLOAD_DIR);
      }
    } catch (err) {
      console.error(`  ❌ Failed to download ${a.id}: ${err}`);
    }
  }
}

function isDownloadable(a: Artifact): boolean {
  if (a.status !== "completed") return false;
  return (
    a.kind === "audio" ||
    a.kind === "video" ||
    a.kind === "report" ||
    a.kind === "quiz" ||
    a.kind === "flashcards"
  );
}

async function downloadAudio(
  client: Awaited<ReturnType<typeof NotebookLMClient.connect>>,
  a: Artifact,
  dir: string,
) {
  if (!a.audioUrl) {
    console.log(`  ⚠️  audio ${a.id} — no URL available`);
    return;
  }
  const filepath = path.join(dir, `${a.id}.mp4`);
  console.log(`  🎧 Downloading audio → downloads/${a.id}.mp4`);
  const buffer = await client.artifacts.downloadAudio(a.notebookId, a.id);
  await fs.writeFile(filepath, buffer);
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`     ✅ Saved (${sizeMB} MB)`);
}

async function downloadVideo(
  client: Awaited<ReturnType<typeof NotebookLMClient.connect>>,
  a: Artifact,
  dir: string,
) {
  if (!a.videoUrl) {
    console.log(`  ⚠️  video ${a.id} — no URL available`);
    return;
  }
  const filepath = path.join(dir, `${a.id}.mp4`);
  console.log(`  🎬 Downloading video → downloads/${a.id}.mp4`);
  const buffer = await client.artifacts.downloadVideo(a.notebookId, a.id);
  await fs.writeFile(filepath, buffer);
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`     ✅ Saved (${sizeMB} MB)`);
}

async function downloadReport(
  client: Awaited<ReturnType<typeof NotebookLMClient.connect>>,
  a: Artifact,
  dir: string,
) {
  const filepath = path.join(dir, `${a.id}.md`);
  console.log(`  📄 Downloading report → downloads/${a.id}.md`);
  const content = await client.artifacts.getReportMarkdown(a.notebookId, a.id);
  if (!content) {
    console.log(`     ⚠️  No content found`);
    return;
  }
  await fs.writeFile(filepath, content);
  console.log(`     ✅ Saved (${content.length} chars)`);
}

async function downloadInteractive(
  client: Awaited<ReturnType<typeof NotebookLMClient.connect>>,
  a: Artifact,
  dir: string,
) {
  const filepath = path.join(dir, `${a.id}.html`);
  const label = a.kind === "quiz" ? "📝" : "🃏";
  console.log(`  ${label} Downloading ${a.kind} → downloads/${a.id}.html`);
  const html = await client.artifacts.getInteractiveHtml(a.notebookId, a.id);
  if (!html) {
    console.log(`     ⚠️  No HTML content found`);
    return;
  }
  await fs.writeFile(filepath, html);
  console.log(`     ✅ Saved (${html.length} chars)`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
