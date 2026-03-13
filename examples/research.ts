import { NotebookLMClient } from "../src/index.js";

async function main() {
  const cookieVar = process.env.NOTEBOOKLM_COOKIE || process.env.NOTEBOOKLM_COOKIES;

  if (!cookieVar) {
    console.error("❌ Please set NOTEBOOKLM_COOKIE in your environment variables or .env file.");
    process.exit(1);
  }

  let opts = {};
  if (cookieVar.trim().startsWith("{") || cookieVar.trim().startsWith("[")) {
    console.log("ℹ️  Parsing cookie from JSON format...");
    opts = { cookiesObject: JSON.parse(cookieVar) };
  } else {
    console.log("ℹ️  Using plain cookie string...");
    opts = { cookies: cookieVar };
  }

  console.log("\n🔄 Connecting to NotebookLM...");
  try {
    const client = await NotebookLMClient.connect(opts);
    console.log("✅ Connected successfully!");

    const notebooks = await client.notebooks.list();

    if (notebooks.length === 0) {
      console.log("No notebooks found. Please create one first.");
      return;
    }

    const nb = notebooks[0];
    console.log(`\n📚 Using notebook: "${nb.title}"`);

    // Start a fast web research session
    console.log("\n🔍 Starting fast web research for 'Latest AI models'...");
    const researchTask = await client.research.start(nb.id, "Latest AI models", "web", "fast");

    if (!researchTask) {
      console.log("Failed to start research.");
      return;
    }

    console.log(`Task started: ${researchTask.taskId}`);

    // Poll for results
    console.log("\n⏳ Polling for research results...");
    let result = await client.research.poll(nb.id);
    let attempts = 0;

    while (result.status === "in_progress" && attempts < 15) {
      console.log("Still researching...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      result = await client.research.poll(nb.id);
      attempts++;
    }

    if (result.status === "completed") {
      console.log("\n✅ Research completed!");
      console.log(`Summary: ${result.summary || "No summary provided."}`);
      console.log(`Found ${result.sources.length} sources.`);

      if (result.sources.length > 0) {
        console.log("\nTop 3 sources:");
        for (const src of result.sources.slice(0, 3)) {
          console.log(`- ${src.title || "Untitled"}`);
          if (src.url) console.log(`  ${src.url}`);
        }

        // Import top 1 source
        console.log("\n📥 Importing the top source to notebook...");
        const imported = await client.research.importSources(nb.id, result.taskId!, [
          result.sources[0],
        ]);
        console.log(`Imported ${imported.length} sources.`);
      }
    } else {
      console.log("\n⏳ Research did not complete in time or had no result.");
    }
  } catch (error) {
    console.error("\n❌ Error connecting or fetching data:");
    console.error(error);
  }
}

main();
