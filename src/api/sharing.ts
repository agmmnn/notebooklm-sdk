import { RPCMethod, ShareAccess, SharePermission, ShareViewLevel } from "../types/enums.js";
import type { ShareAccessValue, SharePermissionValue, ShareViewLevelValue } from "../types/enums.js";
import type { SharedUser, ShareStatus } from "../types/models.js";
import type { RPCCore } from "../rpc/core.js";

export type { ShareAccessValue, SharePermissionValue, ShareViewLevelValue };

export class SharingAPI {
  constructor(private readonly rpc: RPCCore) {}

  /** Get current sharing configuration for a notebook. */
  async getStatus(notebookId: string): Promise<ShareStatus> {
    const params = [notebookId, [2]];
    const result = await this.rpc.call(RPCMethod.GET_SHARE_STATUS, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return parseShareStatus(result as unknown[], notebookId);
  }

  /** Enable or disable public link sharing. Returns updated status. */
  async setPublic(notebookId: string, isPublic: boolean): Promise<ShareStatus> {
    const access = isPublic ? ShareAccess.ANYONE_WITH_LINK : ShareAccess.RESTRICTED;
    const params = [
      [[notebookId, null, [access], [access, ""]]],
      1,
      null,
      [2],
    ];
    await this.rpc.call(RPCMethod.SHARE_NOTEBOOK, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return this.getStatus(notebookId);
  }

  /**
   * Set what viewers can access: full notebook or chat only.
   * Note: GET_SHARE_STATUS doesn't return view_level, so it's inferred from what was set.
   */
  async setViewLevel(notebookId: string, level: ShareViewLevelValue): Promise<ShareStatus> {
    const params = [
      notebookId,
      [[null, null, null, null, null, null, null, null, [[level]]]],
    ];
    await this.rpc.call(RPCMethod.RENAME_NOTEBOOK, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    const status = await this.getStatus(notebookId);
    return { ...status, viewLevel: level };
  }

  /** Share notebook with a user. Returns updated status. */
  async addUser(
    notebookId: string,
    email: string,
    permission: SharePermissionValue = SharePermission.VIEWER,
    opts: { notify?: boolean; welcomeMessage?: string } = {},
  ): Promise<ShareStatus> {
    if (permission === SharePermission.OWNER) throw new Error("Cannot assign OWNER permission");
    if (permission === SharePermission._REMOVE) throw new Error("Use removeUser() instead");

    const { notify = true, welcomeMessage = "" } = opts;
    const messageFlag = welcomeMessage ? 0 : 1;
    const notifyFlag = notify ? 1 : 0;

    const params = [
      [[notebookId, [[email, null, permission]], null, [messageFlag, welcomeMessage]]],
      notifyFlag,
      null,
      [2],
    ];
    await this.rpc.call(RPCMethod.SHARE_NOTEBOOK, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return this.getStatus(notebookId);
  }

  /** Update an existing user's permission level. Returns updated status. */
  async updateUser(
    notebookId: string,
    email: string,
    permission: SharePermissionValue,
  ): Promise<ShareStatus> {
    return this.addUser(notebookId, email, permission, { notify: false });
  }

  /** Remove a user's access to the notebook. Returns updated status. */
  async removeUser(notebookId: string, email: string): Promise<ShareStatus> {
    const params = [
      [[notebookId, [[email, null, SharePermission._REMOVE]], null, [0, ""]]],
      0,
      null,
      [2],
    ];
    await this.rpc.call(RPCMethod.SHARE_NOTEBOOK, params, {
      sourcePath: `/notebook/${notebookId}`,
      allowNull: true,
    });
    return this.getStatus(notebookId);
  }
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

const PERM_MAP: Record<number, SharedUser["permission"]> = {
  1: "owner",
  2: "editor",
  3: "viewer",
};

function parseSharedUser(data: unknown[]): SharedUser {
  const email = typeof data[0] === "string" ? data[0] : "";
  const permCode = typeof data[1] === "number" ? data[1] : 3;
  const permission = PERM_MAP[permCode] ?? "viewer";

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  if (Array.isArray(data[3])) {
    const info = data[3] as unknown[];
    displayName = typeof info[0] === "string" ? info[0] : null;
    avatarUrl = typeof info[1] === "string" ? info[1] : null;
  }

  return { email, permission, displayName, avatarUrl };
}

function parseShareStatus(data: unknown[], notebookId: string): ShareStatus {
  // Response format: [[[user_entries...]], [is_public], 1000]
  const users: SharedUser[] = [];
  if (Array.isArray(data[0])) {
    for (const entry of data[0] as unknown[]) {
      if (Array.isArray(entry)) users.push(parseSharedUser(entry as unknown[]));
    }
  }

  const isPublic = Array.isArray(data[1]) && (data[1] as unknown[])[0] === true;
  const access = isPublic ? ShareAccess.ANYONE_WITH_LINK : ShareAccess.RESTRICTED;
  const shareUrl = isPublic ? `https://notebooklm.google.com/notebook/${notebookId}` : null;

  return {
    notebookId,
    isPublic,
    access,
    viewLevel: ShareViewLevel.FULL_NOTEBOOK,
    sharedUsers: users,
    shareUrl,
  };
}
