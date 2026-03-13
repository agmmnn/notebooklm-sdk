import { RPCMethod } from "../types/enums.js";
import type { Notebook, NotebookDescription, SuggestedTopic } from "../types/models.js";
import { parseNotebook } from "../types/models.js";
import type { RPCCore } from "../rpc/core.js";

export class NotebooksAPI {
  constructor(private readonly rpc: RPCCore) {}

  async list(): Promise<Notebook[]> {
    const params = [null, 1, null, [2]];
    const result = await this.rpc.call(RPCMethod.LIST_NOTEBOOKS, params);
    if (!Array.isArray(result) || !result.length) return [];
    const raw = Array.isArray(result[0]) ? result[0] : result;
    return (raw as unknown[][]).map((nb) => parseNotebook(nb));
  }

  async create(title: string): Promise<Notebook> {
    const params = [title, null, null, [2], [1]];
    const result = await this.rpc.call(RPCMethod.CREATE_NOTEBOOK, params);
    return parseNotebook(result as unknown[]);
  }

  async get(notebookId: string): Promise<Notebook> {
    const params = [notebookId, null, [2], null, 0];
    const result = await this.rpc.call(RPCMethod.GET_NOTEBOOK, params, {
      sourcePath: `/notebook/${notebookId}`,
    });
    const data = Array.isArray(result) && result.length ? result[0] : result;
    return parseNotebook(data as unknown[]);
  }

  async delete(notebookId: string): Promise<boolean> {
    const params = [[notebookId], [2]];
    await this.rpc.call(RPCMethod.DELETE_NOTEBOOK, params);
    return true;
  }

  async rename(notebookId: string, newTitle: string): Promise<Notebook> {
    const params = [notebookId, [[null, null, null, [null, newTitle]]]];
    await this.rpc.call(RPCMethod.RENAME_NOTEBOOK, params, {
      sourcePath: "/",
      allowNull: true,
    });
    return this.get(notebookId);
  }

  async getSummary(notebookId: string): Promise<string> {
    const params = [notebookId, [2]];
    const result = await this.rpc.call(RPCMethod.SUMMARIZE, params, {
      sourcePath: `/notebook/${notebookId}`,
    });
    try {
      if (Array.isArray(result)) {
        const val = (result as unknown[][][])[0]?.[0]?.[0];
        return typeof val === "string" ? val : "";
      }
    } catch {
      // ignore
    }
    return "";
  }

  async getDescription(notebookId: string): Promise<NotebookDescription> {
    const params = [notebookId, [2]];
    const result = await this.rpc.call(RPCMethod.SUMMARIZE, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    let summary = "";
    const suggestedTopics: SuggestedTopic[] = [];

    try {
      if (Array.isArray(result)) {
        const outer = (result as unknown[][])[0];
        if (Array.isArray(outer)) {
          const summaryVal = (outer as unknown[][])[0]?.[0];
          if (typeof summaryVal === "string") summary = summaryVal;

          const topicsList = (outer as unknown[][])[1]?.[0];
          if (Array.isArray(topicsList)) {
            for (const t of topicsList as unknown[][]) {
              const question = typeof t[0] === "string" ? t[0] : "";
              const prompt = typeof t[1] === "string" ? t[1] : "";
              suggestedTopics.push({ question, prompt });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return { summary, suggestedTopics };
  }
}
