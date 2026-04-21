/**
 * 文档系统表结构定义
 */

// ==================== 表结构定义 ====================

/**
 * folders表 - 存储文件夹信息
 * parent_id: 父文件夹ID，NULL表示根目录
 */
export const CREATE_FOLDERS_TABLE = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);
`;

/**
 * documents表 - 存储文档信息
 * folder_id: 所属文件夹ID，NULL表示根目录
 * content: 存储Tiptap JSON格式的文档内容
 */
export const CREATE_DOCUMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  folder_id TEXT,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
`;

/**
 * 文档系统索引
 */
export const CREATE_DOC_INDEXES = [
  // 按用户ID查询文件夹
  `CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);`,
  // 按父文件夹查询子文件夹
  `CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);`,
  // 按用户ID查询文档
  `CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);`,
  // 按文件夹查询文档
  `CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);`,
];

// ==================== 类型定义 ====================

/**
 * Folder类型定义
 */
export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  user_id: string;
  created_at: number;
  updated_at: number;
}

/**
 * Document类型定义
 */
export interface Document {
  id: string;
  title: string;
  content: string | null;
  folder_id: string | null;
  user_id: string;
  created_at: number;
  updated_at: number;
}

/**
 * 创建文件夹的参数类型
 */
export interface CreateFolderParams {
  id: string;
  name: string;
  parentId?: string | null;
  userId: string;
}

/**
 * 创建文档的参数类型
 */
export interface CreateDocumentParams {
  id: string;
  title: string;
  content?: string;
  folderId?: string | null;
  userId: string;
}