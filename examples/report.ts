import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NotebookLMClient } from "../src/index.js";

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

    // Use the first notebook for this example
    const nb = notebooks[0];
    console.log(`Using notebook: [${nb.id}] ${nb.title}`);

    console.log("\n✍️  Triggering a Report generation...");
    console.log(`Format: custom — "Please write a comprehensive summary report of the sources."`);
    const reportTask = await client.artifacts.createReport(nb.id, {
      format: "custom",
      customPrompt: "Please write a comprehensive summary report of the sources.",
    });

    console.log(`✅ Report generation started. Artifact ID: ${reportTask.artifactId!}`);

    console.log(
      "⏳ Waiting for report to finish processing (this may take a minute depending on source size)...",
    );

    // Poll until complete
    const completedReport = await client.artifacts.waitUntilReady(
      nb.id,
      reportTask.artifactId!,
      600,
      3,
    );

    console.log(`🎉 Report generation status: ${completedReport.status}`);

    console.log("\n📥 Downloading the report markdown...");
    const markdownContent = await client.artifacts.getReportMarkdown(nb.id, completedReport.id);

    if (markdownContent) {
      await fs.mkdir("downloads", { recursive: true });
      const filename = path.join("downloads", `report_${completedReport.id.replace(/-/g, "_")}.md`);
      await fs.writeFile(filename, markdownContent);
      console.log(`📁 Report saved to ${filename} (${markdownContent.length} chars)`);
    } else {
      console.log(
        "⚠️ No content found in artifact — it may still be processing or content is stored elsewhere.",
      );
    }
  } catch (error) {
    console.error("\n❌ Error connecting, generating, or fetching data:");
    console.error(error);
  }
}

main();
