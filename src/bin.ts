#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { login } from "./auth/browser.js";

async function run() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "login") {
    console.log("🚀 Starting browser login flow...");
    console.log("A browser window will open. Please log in to your Google account.");

    try {
      const authResult = await login({
        persistFolder: "./.auth_profile",
        headless: false,
      });

      const outPath = resolve(process.cwd(), "storage_state.json");
      writeFileSync(outPath, JSON.stringify(authResult.storageState, null, 2));

      console.log("\n✅ Login successful!");
      console.log(`Saved session to: ${outPath}`);
      console.log("\nNext steps:");
      console.log("In your code, connect using:");
      console.log("const client = await NotebookLMClient.connect({ cookiesFile: 'storage_state.json' });");
    } catch (error) {
      console.error("❌ Login failed:", error);
      process.exit(1);
    }
  } else {
    console.log("NotebookLM SDK CLI");
    console.log("\nUsage:");
    console.log("  npx notebooklm-sdk login    Start browser login flow");
    process.exit(command ? 1 : 0);
  }
}

run();
