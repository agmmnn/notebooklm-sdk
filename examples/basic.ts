import { NotebookLMClient } from "../src/index.js";

async function main() {
  // 1. Read the cookie string from the environment variable (e.g. from .env file)
  const cookieVar =
    process.env.NOTEBOOKLM_COOKIE || process.env.NOTEBOOKLM_COOKIES;

  if (!cookieVar) {
    console.error(
      "❌ Please set NOTEBOOKLM_COOKIE in your environment variables or .env file.",
    );
    process.exit(1);
  }

  // 2. Prepare the connection options
  // The SDK accepts different formats (plain string, parsed JSON object, etc.)
  let opts = {};
  if (cookieVar.trim().startsWith("{")) {
    // If it looks like Playwright storage_state.json content
    console.log("ℹ️  Parsing cookie from JSON format...");
    opts = { cookiesObject: JSON.parse(cookieVar) };
  } else {
    // If it's a standard '; ' separated cookie string
    console.log("ℹ️  Using plain cookie string...");
    opts = { cookies: cookieVar };
  }

  console.log("\n🔄 Connecting to NotebookLM...");
  try {
    // 3. Connect to NotebookLM (fetches CSRF and session tokens)
    const client = await NotebookLMClient.connect(opts);
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
      console.log(
        `\n📄 Fetching sources for the first notebook: "${firstNb.title}"...`,
      );

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
