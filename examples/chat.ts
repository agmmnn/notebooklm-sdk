import { NotebookLMClient } from "../src/index.js";

async function main() {
  const cookieVar = process.env.NOTEBOOKLM_COOKIE || process.env.NOTEBOOKLM_COOKIES;
  if (!cookieVar) { console.error("No cookie"); process.exit(1); }

  const opts = cookieVar.trim().startsWith("{")
    ? { cookiesObject: JSON.parse(cookieVar) }
    : { cookies: cookieVar };

  const client = await NotebookLMClient.connect(opts);
  const notebooks = await client.notebooks.list();
  const nb = notebooks[0]!;
  console.log(`Notebook: ${nb.title}`);

  console.log("\nAsking: What is this notebook about?");
  const result = await client.chat.ask(nb.id, "What is this notebook about? Give a 1-sentence summary.");
  console.log(`Answer: ${result.answer}`);
  console.log(`ConversationId: ${result.conversationId}`);
  console.log(`References: ${result.references.length}`);

  console.log("\nFollow-up:");
  const result2 = await client.chat.ask(nb.id, "What's the main topic in one word?", { conversationId: result.conversationId });
  console.log(`Answer: ${result2.answer}`);
}

main().catch(console.error);
