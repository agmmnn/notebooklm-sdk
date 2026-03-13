import type { RPCCore } from "../rpc/core.js";
import { RPCMethod } from "../types/enums.js";
import type { MindMap, Note } from "../types/models.js";
import { parseNote } from "../types/models.js";

export class NotesAPI {
  constructor(private readonly rpc: RPCCore) {}

  async list(notebookId: string): Promise<{ notes: Note[]; mindMaps: MindMap[] }> {
    const params = [notebookId, [2]];
    const result = await this.rpc.call(RPCMethod.GET_NOTES_AND_MIND_MAPS, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    const notes: Note[] = [];
    const mindMaps: MindMap[] = [];

    if (!Array.isArray(result)) return { notes, mindMaps };

    try {
      // Notes at result[0], mind maps at result[1]
      const notesData = result[0] as unknown[][];
      if (Array.isArray(notesData)) {
        for (const n of notesData) {
          if (Array.isArray(n)) notes.push(parseNote(n));
        }
      }

      const mapsData = result[1] as unknown[][];
      if (Array.isArray(mapsData)) {
        for (const m of mapsData) {
          if (Array.isArray(m)) {
            mindMaps.push({
              id: typeof m[0] === "string" ? (m[0] as string) : "",
              title: typeof m[2] === "string" ? (m[2] as string) : null,
              content: typeof m[1] === "string" ? (m[1] as string) : "",
              createdAt:
                Array.isArray(m[3]) && typeof m[3][0] === "number"
                  ? new Date((m[3][0] as number) * 1000)
                  : null,
            });
          }
        }
      }
    } catch {
      // ignore parse errors
    }

    return { notes, mindMaps };
  }

  async create(notebookId: string, content: string, title?: string): Promise<Note> {
    const params = [notebookId, content, title ?? null, [2]];
    const result = await this.rpc.call(RPCMethod.CREATE_NOTE, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    if (Array.isArray(result)) return parseNote(result as unknown[]);
    throw new Error("Could not parse note creation response");
  }

  async update(notebookId: string, noteId: string, content: string, title?: string): Promise<Note> {
    const params = [notebookId, noteId, content, title ?? null, [2]];
    const result = await this.rpc.call(RPCMethod.UPDATE_NOTE, params, {
      sourcePath: `/notebook/${notebookId}`,
    });

    if (Array.isArray(result)) return parseNote(result as unknown[]);
    // If update returns null/void, return a stub
    return { id: noteId, title: title ?? null, content, createdAt: null, updatedAt: new Date() };
  }

  async delete(notebookId: string, noteId: string): Promise<boolean> {
    const params = [notebookId, noteId, [2]];
    await this.rpc.call(RPCMethod.DELETE_NOTE, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return true;
  }
}
