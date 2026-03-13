import { RPCMethod } from "../types/enums.js";
import type { RPCCore } from "../rpc/core.js";

export class SettingsAPI {
  constructor(private readonly rpc: RPCCore) {}

  /** Get the current output language setting (e.g. "en", "ja", "zh_Hans"). */
  async getOutputLanguage(): Promise<string | null> {
    const params = [null, [1, null, null, null, null, null, null, null, null, null, [1]]];
    const result = await this.rpc.call(RPCMethod.GET_USER_SETTINGS, params, {
      sourcePath: "/",
      allowNull: true,
    });
    // result[0][2][4][0]
    return extractNested(result as unknown[], [0, 2, 4, 0]);
  }

  /**
   * Set the output language for artifact generation.
   * Pass a BCP-47 language code, e.g. "en", "ja", "zh_Hans".
   * Returns the language that was set, or null if the response couldn't be parsed.
   */
  async setOutputLanguage(language: string): Promise<string | null> {
    if (!language) return null;
    const params = [[[null, [[null, null, null, null, [language]]]]]];
    const result = await this.rpc.call(RPCMethod.SET_USER_SETTINGS, params, {
      sourcePath: "/",
      allowNull: true,
    });
    // result[2][4][0]
    return extractNested(result as unknown[], [2, 4, 0]);
  }
}

function extractNested(data: unknown, path: number[]): string | null {
  try {
    let cur: unknown = data;
    for (const idx of path) {
      if (!Array.isArray(cur)) return null;
      cur = cur[idx];
    }
    return typeof cur === "string" && cur ? cur : null;
  } catch {
    return null;
  }
}
