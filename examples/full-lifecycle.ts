import { NotebookLMClient } from "../src/index.js";

async function main() {
  console.log("\n🔄 Connecting to NotebookLM...");
  try {
    const client = await NotebookLMClient.connect({
      cookiesFile: "storage_state.json",
    });
    console.log("✅ Connected successfully!");

    // 1. Create a new notebook
    console.log("\n📓 Creating a new notebook...");
    const { id: notebookId } = await client.notebooks.create("Temp Work Notebook");
    console.log(`✅ Created notebook with ID: ${notebookId}`);

    // 2. Rename it
    console.log("\n✏️ Renaming notebook...");
    await client.notebooks.rename(notebookId, "My Quick Test Notebook");
    const nb = await client.notebooks.get(notebookId);
    console.log(`✅ Renamed to: "${nb.title}"`);

    // 3. Add sources
    console.log("\n➕ Adding sources...");

    // 3a. Add a text source
    console.log("  -> Adding Text Source...");
    const textSource = await client.sources.addText(
      notebookId,
      "The mitochondria is the powerhouse of the cell. It generates most of the chemical energy needed to power the cell's biochemical reactions.",
      "Biology Fact",
    );
    console.log(`     Added source: ${textSource.id}`);

    // 3b. Add a YouTube URL source
    console.log("  -> Adding YouTube Source...");
    const urlSource = await client.sources.addUrl(
      notebookId,
      "https://www.youtube.com/watch?v=jNQXAC9IVRw", // Me at the zoo (first youtube video)
    );
    console.log(`     Added source: ${urlSource.id}`);

    // 3c. Add a Website URL source
    console.log("  -> Adding Website Source...");
    const wikiSource = await client.sources.addUrl(
      notebookId,
      "https://en.wikipedia.org/wiki/NotebookLM",
    );
    console.log(`     Added source: ${wikiSource.id}`);

    // 3d. Upload a raw file buffer (e.g. creating a fake markdown file buffer in memory)
    console.log("  -> Uploading File Source (Buffer)...");
    const fileContent = Buffer.from(
      "# Welcome to my test file\n\nThis is a temporary markdown file uploaded directly via a buffer.",
    );
    const fileSource = await client.sources.addFileBuffer(
      notebookId,
      fileContent,
      "test_document.md",
      "text/markdown",
    );
    console.log(`     Added source: ${fileSource.id}`);

    // 4. Wait for all sources to be processed ("ready")
    console.log("\n⏳ Waiting for sources to finish processing...");
    await Promise.all([
      client.sources.waitUntilReady(notebookId, textSource.id),
      client.sources.waitUntilReady(notebookId, urlSource.id),
      client.sources.waitUntilReady(notebookId, wikiSource.id),
      client.sources.waitUntilReady(notebookId, fileSource.id),
    ]);
    console.log("✅ All sources are processed and ready!");

    // 5. Ask a fast question directly using the chat API
    const question =
      "Briefly summarize the biology fact, mention what the youtube video is about, and outline what NotebookLM is based on the Wikipedia page.";
    console.log(`\n💬 Asking question: "${question}"`);
    const chatResult = await client.chat.ask(notebookId, question);

    console.log("\n🤖 Answer:");
    console.log(chatResult.answer);
    //sleep before deleting
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 6. Delete the notebook to clean up
    console.log(`\n🗑️ Deleting notebook ${notebookId}...`);
    await client.notebooks.delete(notebookId);
    console.log("✅ Notebook deleted. Cleaned up successfully!");
  } catch (error) {
    console.error("\n❌ Error connecting or fetching data:");
    console.error(error);
  }
}

main();
