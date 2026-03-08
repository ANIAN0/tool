/**
 * 文件夹数据操作模块
 * 提供文件夹的CRUD操作
 */

import { getDb } from "./client";
import type { Folder, CreateFolderParams } from "./schema";

/**
 * 获取用户的所有文件夹
 * @param userId 用户ID
 * @returns 文件夹列表
 */
export async function getFoldersByUserId(userId: string): Promise<Folder[]> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM folders WHERE user_id = ? ORDER BY updated_at DESC",
    args: [userId],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    parent_id: row.parent_id as string | null,
    user_id: row.user_id as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

/**
 * 获取指定文件夹下的子文件夹
 * @param parentId 父文件夹ID
 * @returns 子文件夹列表
 */
export async function getFoldersByParentId(parentId: string | null): Promise<Folder[]> {
  const db = getDb();
  const result = await db.execute({
    sql: parentId
      ? "SELECT * FROM folders WHERE parent_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM folders WHERE parent_id IS NULL ORDER BY updated_at DESC",
    args: parentId ? [parentId] : [],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    parent_id: row.parent_id as string | null,
    user_id: row.user_id as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

/**
 * 根据ID获取文件夹
 * @param id 文件夹ID
 * @returns 文件夹或null
 */
export async function getFolderById(id: string): Promise<Folder | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM folders WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id as string,
    name: row.name as string,
    parent_id: row.parent_id as string | null,
    user_id: row.user_id as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

/**
 * 创建新文件夹
 * @param params 创建参数
 * @returns 创建的文件夹
 */
export async function createFolder(params: CreateFolderParams): Promise<Folder> {
  const db = getDb();
  const now = Date.now();

  await db.execute({
    sql: `
      INSERT INTO folders (id, name, parent_id, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [params.id, params.name, params.parentId ?? null, params.userId, now, now],
  });

  return {
    id: params.id,
    name: params.name,
    parent_id: params.parentId ?? null,
    user_id: params.userId,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 更新文件夹名称
 * @param id 文件夹ID
 * @param name 新名称
 * @returns 是否成功
 */
export async function updateFolder(id: string, name: string): Promise<boolean> {
  const db = getDb();
  const now = Date.now();

  const result = await db.execute({
    sql: "UPDATE folders SET name = ?, updated_at = ? WHERE id = ?",
    args: [name, now, id],
  });

  return result.rowsAffected > 0;
}

/**
 * 删除文件夹（会级联删除子文件夹和文档）
 * @param id 文件夹ID
 * @returns 是否成功
 */
export async function deleteFolder(id: string): Promise<boolean> {
  const db = getDb();

  const result = await db.execute({
    sql: "DELETE FROM folders WHERE id = ?",
    args: [id],
  });

  return result.rowsAffected > 0;
}

/**
 * 获取文件夹树结构
 * @param userId 用户ID
 * @returns 树形结构的文件夹列表
 */
export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
}

export async function getFolderTree(userId: string): Promise<FolderTreeNode[]> {
  const folders = await getFoldersByUserId(userId);

  // 构建树结构
  const folderMap = new Map<string, FolderTreeNode>();
  const rootFolders: FolderTreeNode[] = [];

  // 首先创建所有节点的映射
  for (const folder of folders) {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
    });
  }

  // 然后构建父子关系
  for (const folder of folders) {
    const node = folderMap.get(folder.id)!;
    if (folder.parent_id) {
      const parent = folderMap.get(folder.parent_id);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      rootFolders.push(node);
    }
  }

  return rootFolders;
}
