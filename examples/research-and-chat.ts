import { NotebookLMClient } from "../src/index.js";

async function main() {
  const cookieVar = process.env.NOTEBOOKLM_COOKIE || process.env.NOTEBOOKLM_COOKIES;

  if (!cookieVar) {
    console.error("❌ Please set NOTEBOOKLM_COOKIE in your environment variables or .env file.");
    process.exit(1);
  }

  let opts = {};
  if (cookieVar.trim().startsWith("{") || cookieVar.trim().startsWith("[")) {
    opts = { cookiesObject: JSON.parse(cookieVar) };
  } else {
    opts = { cookies: cookieVar };
  }

  console.log("\n🔄 Connecting to NotebookLM...");
  try {
    const client = await NotebookLMClient.connect(opts);
    console.log("✅ Connected successfully!");

    // 1. Create a new notebook
    console.log("\n📓 Creating a new notebook...");
    const { id: notebookId } = await client.notebooks.create("Research & Chat Demo");
    console.log(`✅ Created notebook with ID: ${notebookId}`);

    // 2. Start fast research
    const query =
      "What are the latest breakthroughs in solid-state batteries in 2026? Give me specific companies and dates.";
    console.log(`\n🔍 Starting fast web research for query: "${query}"...`);
    const researchTask = await client.research.start(notebookId, query, "web", "fast");

    if (!researchTask) {
      console.log("❌ Failed to start research.");
      return;
    }

    console.log(`⏳ Task started: ${researchTask.taskId}. Polling for results...`);

    // Poll for results
    let result = await client.research.poll(notebookId);
    let attempts = 0;

    while (result.status === "in_progress" && attempts < 15) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      process.stdout.write("."); // Print dots while waiting
      result = await client.research.poll(notebookId);
      attempts++;
    }
    console.log(); // Newline after dots

    if (result.status === "completed") {
      console.log(`\n✅ Research completed!`);
      console.log(`Summary: ${result.summary || "No summary provided."}`);
      console.log(`Found ${result.sources.length} sources.`);

      if (result.sources.length > 0) {
        // 3. Import top sources into the notebook
        console.log("\n📥 Importing the top 3 sources to the notebook...");
        const sourcesToImport = result.sources.slice(0, 3);
        const imported = await client.research.importSources(
          notebookId,
          result.taskId!,
          sourcesToImport,
        );
        console.log(`✅ Imported ${imported.length} sources.`);

        // Wait a few seconds for NotebookLM to process the sources before chatting
        // NotebookLM might take a brief moment to ingest and index imported URLs.
        console.log("\n⏳ Waiting 5 seconds for NotebookLM to process the imported sources...");
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 4. Chat with the notebook!
        const chatQuestion =
          "Based strictly on the imported sources, what are the names of the companies working on solid-state batteries?";
        console.log(`\n💬 Asking question: "${chatQuestion}"`);
        const chatResult = await client.chat.ask(notebookId, chatQuestion);

        console.log("\n🤖 Answer:");
        console.log(chatResult.answer);

        if (chatResult.references && chatResult.references.length > 0) {
          console.log("\n📚 References used by the AI:");
          for (const ref of chatResult.references) {
            console.log(`   - [${ref.sourceId}] ${ref.title}: ${ref.url || "No URL"}`);
          }
        }
      }
    } else {
      console.log("\n⏳ Research did not complete in time or had no result.");
    }

    // Optional: Clean up by deleting the notebook after the demo
    // console.log(`\n🗑️ Deleting notebook ${notebookId}...`);
    // await client.notebooks.delete(notebookId);
    // console.log("✅ Done.");
  } catch (error) {
    console.error("\n❌ Error connecting or fetching data:");
    console.error(error);
  }
}

main();
