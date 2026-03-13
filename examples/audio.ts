import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NotebookLMClient } from "../src/index.js";
import { AudioFormat, AudioLength } from "../src/types/enums.js";

async function main() {
  console.log("\n🔄 Connecting to NotebookLM...");
  try {
    const client = await NotebookLMClient.connect({
      cookiesFile: "storage_state.json",
    });
    console.log("✅ Connected successfully!");

    console.log("\n📚 Fetching notebooks...");
    const notebooks = await client.notebooks.list();
    if (notebooks.length === 0) {
      console.error("❌ No notebooks found. Please create a notebook first.");
      process.exit(1);
    }

    const nb = notebooks[0];
    console.log(`Using notebook: [${nb.id}] ${nb.title}`);

    console.log("\n🎙️  Triggering Deep Dive podcast generation...");
    const audioTask = await client.artifacts.createAudio(nb.id, {
      format: AudioFormat.DEEP_DIVE,
      length: AudioLength.DEFAULT,
    });

    if (!audioTask.artifactId) {
      console.error("❌ Failed to start audio generation — no artifact ID returned.");
      process.exit(1);
    }

    console.log(`✅ Audio generation started. Artifact ID: ${audioTask.artifactId}`);
    console.log("⏳ Waiting for podcast to finish generating (this may take several minutes)...");

    const completedAudio = await client.artifacts.waitUntilReady(
      nb.id,
      audioTask.artifactId,
      600,
      5,
    );
    console.log(`🎉 Podcast generation status: ${completedAudio.status}`);

    if (!completedAudio.audioUrl) {
      console.error("❌ No audio URL on completed artifact — cannot download.");
      process.exit(1);
    }

    console.log(`\n📥 Downloading podcast audio...`);
    const buffer = await client.artifacts.downloadAudio(nb.id, completedAudio.id);

    await fs.mkdir("downloads", { recursive: true });
    const filename = path.join("downloads", `podcast_${completedAudio.id.replace(/-/g, "_")}.mp3`);
    await fs.writeFile(filename, buffer);
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`🎧 Saved to ${filename} (${sizeMB} MB)`);
  } catch (error) {
    console.error("\n❌ Error:");
    console.error(error);
  }
}

main();
