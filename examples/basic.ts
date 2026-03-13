import { NotebookLMClient } from "../src/index.js";

async function main() {
  console.log("\n🔄 Connecting to NotebookLM...");
  try {
    // 1. Connect to NotebookLM
    // Prioritizes storage_state.json if it exists, otherwise falls back to NOTEBOOKLM_COOKIE env var
    const client = await NotebookLMClient.connect({
      cookiesFile: "storage_state.json",
    });
    console.log("✅ Connected successfully!");

    // 4. Use the SDK! List existing notebooks
    console.log("\n📚 Fetching notebooks...");
    const notebooks = await client.notebooks.list();

    console.log(`Found ${notebooks.length} notebooks.`);

    // Display up to the first 5 notebooks
    for (const nb of notebooks.slice(0, 5)) {
      console.log(`- [${nb.id}] ${nb.title}`);
    }

    // 5. Example: List sources for the first notebook
    if (notebooks.length > 0) {
      const firstNb = notebooks[0];
      console.log(`\n📄 Fetching sources for the first notebook: "${firstNb.title}"...`);

      const sources = await client.sources.list(firstNb.id);
      console.log(`Found ${sources.length} sources.`);

      for (const src of sources.slice(0, 5)) {
        console.log(`  - ${src.title || src.id}`);
      }
    }
  } catch (error) {
    console.error("\n❌ Error connecting or fetching data:");
    console.error(error);
  }
}

main();
