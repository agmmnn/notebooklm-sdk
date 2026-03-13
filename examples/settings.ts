import { NotebookLMClient } from "../src/index.js";

async function main() {
  const client = await NotebookLMClient.connect({
    cookiesFile: "storage_state.json",
  });
  console.log("✅ Connected\n");

  const lang = await client.settings.getOutputLanguage();
  console.log(`🌐 Output language: ${lang}`);

  const notebooks = await client.notebooks.list();
  const nb = notebooks[0]!;
  const status = await client.sharing.getStatus(nb.id);
  console.log(`\n📓 Notebook: ${nb.title}`);
  console.log(`   isPublic:    ${status.isPublic}`);
  console.log(`   sharedUsers: ${status.sharedUsers.length}`);
  console.log(`   shareUrl:    ${status.shareUrl ?? "(none)"}`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
