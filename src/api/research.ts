import type { RPCCore } from "../rpc/core.js";
import type { RPCMethodId } from "../types/enums.js";
import { RPCMethod } from "../types/enums.js";

export interface ResearchTask {
  taskId: string;
  reportId: string | null;
  notebookId: string;
  query: string;
  mode: "fast" | "deep";
}

export interface ResearchSource {
  url: string;
  title: string;
  /** 1=web, 2=drive, 5=deep research report */
  resultType: number;
  researchTaskId: string;
  /** Markdown content for deep research report entries (resultType=5) */
  reportMarkdown?: string;
}

export interface ResearchResult {
  taskId: string | null;
  status: "in_progress" | "completed" | "no_research";
  query: string;
  sources: ResearchSource[];
  summary: string;
  report: string;
  tasks: ResearchResult[];
}

export interface ImportedSource {
  id: string;
  title: string;
}

export class ResearchAPI {
  constructor(private readonly rpc: RPCCore) {}

  /**
   * Start a research session.
   * @param source "web" or "drive"
   * @param mode "fast" or "deep" (deep only available for web)
   */
  async start(
    notebookId: string,
    query: string,
    source: "web" | "drive" = "web",
    mode: "fast" | "deep" = "fast",
  ): Promise<ResearchTask | null> {
    if (mode === "deep" && source === "drive") {
      throw new Error("Deep research only supports web sources.");
    }

    const sourceType = source === "web" ? 1 : 2;

    let rpcId: RPCMethodId;
    let params: unknown[];
    if (mode === "fast") {
      rpcId = RPCMethod.START_FAST_RESEARCH;
      params = [[query, sourceType], null, 1, notebookId];
    } else {
      rpcId = RPCMethod.START_DEEP_RESEARCH;
      params = [null, [1], [query, sourceType], 5, notebookId];
    }

    const result = await this.rpc.call(rpcId, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });

    if (Array.isArray(result) && result.length > 0) {
      return {
        taskId: result[0] as string,
        reportId: result.length > 1 ? (result[1] as string) : null,
        notebookId,
        query,
        mode,
      };
    }
    return null;
  }

  /** Poll for current research results in a notebook. */
  async poll(notebookId: string): Promise<ResearchResult> {
    const params = [null, null, notebookId];
    let result = (await this.rpc.call(RPCMethod.POLL_RESEARCH, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    })) as unknown[];

    if (!Array.isArray(result) || !result.length) {
      return emptyResult();
    }

    // Unwrap if double-nested
    if (Array.isArray(result[0]) && Array.isArray((result[0] as unknown[])[0])) {
      result = result[0] as unknown[];
    }

    const parsedTasks: ResearchResult[] = [];

    for (const taskData of result) {
      if (!Array.isArray(taskData) || taskData.length < 2) continue;

      const taskId = taskData[0] as string;
      const taskInfo = taskData[1] as unknown[];
      if (typeof taskId !== "string" || !Array.isArray(taskInfo)) continue;

      const queryText = Array.isArray(taskInfo[1])
        ? (((taskInfo[1] as unknown[])[0] as string) ?? "")
        : "";
      const sourcesAndSummary = Array.isArray(taskInfo[3]) ? (taskInfo[3] as unknown[]) : [];
      const statusCode = typeof taskInfo[4] === "number" ? taskInfo[4] : null;

      const sourcesData = Array.isArray(sourcesAndSummary[0])
        ? (sourcesAndSummary[0] as unknown[])
        : [];
      const summary = typeof sourcesAndSummary[1] === "string" ? sourcesAndSummary[1] : "";

      const parsedSources: ResearchSource[] = [];
      let report = "";

      for (const src of sourcesData) {
        if (!Array.isArray(src) || src.length < 2) continue;

        let url = "";
        let title = "";
        let sourceReport = "";
        let resultType = parseResultType(src.length > 3 ? src[3] : 1);

        if (src[0] === null) {
          // Deep research entry
          if (
            Array.isArray(src[1]) &&
            src[1].length >= 2 &&
            typeof src[1][0] === "string" &&
            typeof src[1][1] === "string"
          ) {
            title = src[1][0] as string;
            sourceReport = src[1][1] as string;
            if (resultType === 1) resultType = 5;
          } else if (typeof src[1] === "string") {
            title = src[1] as string;
            if (resultType === 1) resultType = 5;
          }
        } else {
          // Fast research / web entry
          url = typeof src[0] === "string" ? src[0] : "";
          title = src.length > 1 && typeof src[1] === "string" ? src[1] : "";
        }

        if (title || url) {
          const parsed: ResearchSource = { url, title, resultType, researchTaskId: taskId };
          if (sourceReport) parsed.reportMarkdown = sourceReport;
          parsedSources.push(parsed);

          if (!report && sourceReport) {
            report = sourceReport;
          } else if (!report) {
            const legacyReport = extractLegacyReport(src);
            if (legacyReport) {
              report = legacyReport;
              parsed.reportMarkdown = legacyReport;
            }
          }
        }
      }

      // Research status codes: 1=in_progress, 2=completed, 6=completed (deep)
      const status = statusCode === 2 || statusCode === 6 ? "completed" : "in_progress";

      parsedTasks.push({
        taskId,
        status,
        query: queryText,
        sources: parsedSources,
        summary,
        report,
        tasks: [],
      });
    }

    if (parsedTasks.length > 0) {
      return { ...parsedTasks[0]!, tasks: parsedTasks };
    }
    return emptyResult();
  }

  /**
   * Import selected research sources into the notebook.
   * Pass sources from poll() — web sources need `url`, deep research report entries
   * need `reportMarkdown` (resultType=5).
   *
   * Note: The API may return fewer items than imported. Use sources.list() to verify.
   */
  async importSources(
    notebookId: string,
    taskId: string,
    sources: ResearchSource[],
  ): Promise<ImportedSource[]> {
    if (!sources.length) return [];

    // All sources must come from the same research task
    const taskIds = new Set(sources.map((s) => s.researchTaskId).filter(Boolean));
    if (taskIds.size > 1)
      throw new Error("Cannot import sources from multiple research tasks in one batch.");
    const effectiveTaskId = taskIds.size === 1 ? [...taskIds][0]! : taskId;

    const reportSources = sources.filter((s) => s.resultType === 5 && s.title && s.reportMarkdown);
    const reportSourceSet = new Set(reportSources);
    const webSources = sources.filter((s) => s.url && !reportSourceSet.has(s));

    if (!webSources.length && !reportSources.length) return [];

    const sourceArray: unknown[] = [
      ...reportSources.map((s) => buildReportEntry(s.title, s.reportMarkdown!)),
      ...webSources.map((s) => buildWebEntry(s.url, s.title)),
    ];

    const params = [null, [1], effectiveTaskId, notebookId, sourceArray];
    let result = (await this.rpc.call(RPCMethod.IMPORT_RESEARCH, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    })) as unknown[];

    if (!Array.isArray(result)) return [];

    // Unwrap if double-nested
    if (
      result.length > 0 &&
      Array.isArray(result[0]) &&
      Array.isArray((result[0] as unknown[])[0])
    ) {
      result = result[0] as unknown[];
    }

    const imported: ImportedSource[] = [];
    for (const srcData of result) {
      if (!Array.isArray(srcData) || srcData.length < 2) continue;
      const first = srcData[0];
      const srcId = Array.isArray(first) && first.length > 0 ? (first[0] as string) : null;
      if (srcId) imported.push({ id: srcId, title: srcData[1] as string });
    }
    return imported;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResultType(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const aliases: Record<string, number> = { web: 1, drive: 2, report: 5 };
    return aliases[value.toLowerCase()] ?? 1;
  }
  return 1;
}

function extractLegacyReport(src: unknown[]): string {
  if (src.length <= 6 || !Array.isArray(src[6])) return "";
  return (src[6] as unknown[])
    .filter((c): c is string => typeof c === "string" && !!c)
    .join("\n\n");
}

function buildReportEntry(title: string, markdown: string): unknown[] {
  return [null, [title, markdown], null, 3, null, null, null, null, null, null, 3];
}

function buildWebEntry(url: string, title: string): unknown[] {
  return [null, null, [url, title], null, null, null, null, null, null, null, 2];
}

function emptyResult(): ResearchResult {
  return {
    taskId: null,
    status: "no_research",
    query: "",
    sources: [],
    summary: "",
    report: "",
    tasks: [],
  };
}
