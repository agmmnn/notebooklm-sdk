import { writeFileSync } from "node:fs";
import { login } from "../src/auth/browser.js";
import { NotebookLMClient } from "../src/index.js";

async function main() {
  console.log("🚀 Starting browser login flow...");
  console.log("A browser window will open. Please log in to your Google account.");

  try {
    const authResult = await login({
      persistFolder: "./.auth_profile",
      headless: false,
    });

    console.log("\n✅ Login successful!");

    // Save to a file for easier reuse
    writeFileSync("storage_state.json", JSON.stringify(authResult.storageState, null, 2));
    console.log("Full storage state saved to: storage_state.json");

    console.log("\n📓 Verifying session by listing last 3 notebooks...");
    const client = await NotebookLMClient.connect({
      cookiesObject: authResult.storageState,
    });

    const notebooks = await client.notebooks.list();
    const last3 = notebooks.slice(0, 3);

    if (last3.length === 0) {
      console.log("No notebooks found.");
    } else {
      for (const nb of last3) {
        console.log(`- ${nb.title} (${nb.id})`);
      }
    }

    console.log("\nReady to use!");
  } catch (error) {
    console.error("❌ Login failed:", error);
  }
}

main();
