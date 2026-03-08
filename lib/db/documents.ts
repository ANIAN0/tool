/**
 * 文档数据操作模块
 * 提供文档的CRUD操作
 */

import { getDb } from "./client";
import type { Document, CreateDocumentParams } from "./schema";

/**
 * 获取用户的所有文档
 * @param userId 用户ID
 * @returns 文档列表
 */
export async function getDocumentsByUserId(userId: string): Promise<Document[]> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC",
    args: [userId],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    content: row.content as string | null,
    folder_id: row.folder_id as string | null,
    user_id: row.user_id as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

/**
 * 获取指定文件夹下的文档
 * @param folderId 文件夹ID
 * @returns 文档列表
 */
export async function getDocumentsByFolderId(folderId: string | null): Promise<Document[]> {
  const db = getDb();
  const result = await db.execute({
    sql: folderId
      ? "SELECT * FROM documents WHERE folder_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM documents WHERE folder_id IS NULL ORDER BY updated_at DESC",
    args: folderId ? [folderId] : [],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    content: row.content as string | null,
    folder_id: row.folder_id as string | null,
    user_id: row.user_id as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

/**
 * 根据ID获取文档
 * @param id 文档ID
 * @returns 文档或null
 */
export async function getDocumentById(id: string): Promise<Document | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM documents WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string | null,
    folder_id: row.folder_id as string | null,
    user_id: row.user_id as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

/**
 * 创建新文档
 * @param params 创建参数
 * @returns 创建的文档
 */
export async function createDocument(params: CreateDocumentParams): Promise<Document> {
  const db = getDb();
  const now = Date.now();
  const content = params.content ?? JSON.stringify({ type: "doc", content: [] });

  await db.execute({
    sql: `
      INSERT INTO documents (id, title, content, folder_id, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [params.id, params.title, content, params.folderId ?? null, params.userId, now, now],
  });

  return {
    id: params.id,
    title: params.title,
    content: content,
    folder_id: params.folderId ?? null,
    user_id: params.userId,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 更新文档
 * @param id 文档ID
 * @param updates 更新字段
 * @returns 是否成功
 */
export async function updateDocument(
  id: string,
  updates: { title?: string; content?: string }
): Promise<boolean> {
  const db = getDb();
  const now = Date.now();

  // 构建动态更新SQL
  const fields: string[] = [];
  const args: (string | number)[] = [];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    args.push(updates.title);
  }

  if (updates.content !== undefined) {
    fields.push("content = ?");
    args.push(updates.content);
  }

  if (fields.length === 0) {
    return false;
  }

  fields.push("updated_at = ?");
  args.push(now);
  args.push(id);

  const result = await db.execute({
    sql: `UPDATE documents SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });

  return result.rowsAffected > 0;
}

/**
 * 删除文档
 * @param id 文档ID
 * @returns 是否成功
 */
export async function deleteDocument(id: string): Promise<boolean> {
  const db = getDb();

  const result = await db.execute({
    sql: "DELETE FROM documents WHERE id = ?",
    args: [id],
  });

  return result.rowsAffected > 0;
}

/**
 * 移动文档到指定文件夹
 * @param documentId 文档ID
 * @param folderId 目标文件夹ID（null表示移动到根目录）
 * @returns 是否成功
 */
export async function moveDocument(documentId: string, folderId: string | null): Promise<boolean> {
  const db = getDb();
  const now = Date.now();

  const result = await db.execute({
    sql: "UPDATE documents SET folder_id = ?, updated_at = ? WHERE id = ?",
    args: [folderId, now, documentId],
  });

  return result.rowsAffected > 0;
}
