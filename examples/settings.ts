import { NotebookLMClient } from "../src/index.js";

async function main() {
  const cookieVar = process.env.NOTEBOOKLM_COOKIE || process.env.NOTEBOOKLM_COOKIES;
  if (!cookieVar) { console.error("❌ Please set NOTEBOOKLM_COOKIE in your .env file."); process.exit(1); }
  const opts = cookieVar.trim().startsWith("{") ? { cookiesObject: JSON.parse(cookieVar) } : { cookies: cookieVar };
  const client = await NotebookLMClient.connect(opts);
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

main().catch((err) => { console.error("❌ Fatal error:", err); process.exit(1); });
