import { getDb } from "./client";
// 从 schemas 目录导入表结构定义
import {
  CREATE_USERS_TABLE,
  CREATE_CONVERSATIONS_TABLE,
  CREATE_MESSAGES_TABLE,
  CREATE_CONVERSATION_INDEXES,
  MIGRATION_ADD_AGENT_ID,
  MIGRATION_ADD_IS_PRIVATE,
  MIGRATION_ADD_SOURCE,
  MIGRATION_ADD_COMPRESSION_CACHE,
  MIGRATION_ADD_MESSAGE_TYPE,
  CREATE_FOLDERS_TABLE,
  CREATE_DOCUMENTS_TABLE,
  CREATE_DOC_INDEXES,
  CREATE_USER_MODELS_TABLE,
  CREATE_USER_MODEL_INDEXES,
  MIGRATION_ADD_CONTEXT_LIMIT,
  CREATE_USER_MCP_SERVERS_TABLE,
  CREATE_MCP_TOOLS_TABLE,
  CREATE_MCP_SERVERS_INDEXES,
  CREATE_AGENTS_TABLE,
  CREATE_AGENT_TOOLS_TABLE,
  CREATE_AGENTS_INDEXES,
  CREATE_USER_SKILLS_TABLE,
  CREATE_AGENT_SKILLS_TABLE,
  CREATE_SKILLS_INDEXES,
  CREATE_USER_API_KEYS_TABLE,
  CREATE_API_KEYS_INDEXES,
  CREATE_DELETED_MESSAGES_TABLE,
  CREATE_DELETED_MESSAGES_INDEXES,
  CREATE_COMPRESSION_TASKS_TABLE,
  CREATE_COMPRESSION_TASKS_INDEXES,
  CREATE_CHECKPOINTS_TABLE,
  MIGRATION_ADD_CHECKPOINT_CACHE_CONTENT,
  CREATE_CHECKPOINTS_INDEXES,
} from "@/lib/schemas";

/**
 * 初始化数据库表结构
 * 创建users、conversations、messages、folders和documents表及其索引
 */
export async function initDatabase(): Promise<void> {
  const db = getDb();

  // 先创建users表
  await db.execute(CREATE_USERS_TABLE);

  // 创建conversations和messages表
  await db.execute(CREATE_CONVERSATIONS_TABLE);
  await db.execute(CREATE_MESSAGES_TABLE);

  // 创建对话相关索引
  for (const sql of CREATE_CONVERSATION_INDEXES) {
    await db.execute(sql);
  }

  // 创建文档系统的表
  await db.execute(CREATE_FOLDERS_TABLE);
  await db.execute(CREATE_DOCUMENTS_TABLE);

  // 创建用户模型表
  await db.execute(CREATE_USER_MODELS_TABLE);

  // 创建用户模型索引
  for (const sql of CREATE_USER_MODEL_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      console.log("用户模型索引创建跳过或失败:", error);
    }
  }

  // 创建MCP服务器表
  await db.execute(CREATE_USER_MCP_SERVERS_TABLE);

  // 创建MCP工具表
  await db.execute(CREATE_MCP_TOOLS_TABLE);

  // 创建MCP服务器相关索引
  for (const sql of CREATE_MCP_SERVERS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      console.log("MCP服务器索引创建跳过或失败:", error);
    }
  }

  // 创建文档系统索引（忽略错误，因为索引可能已经存在）
  for (const sql of CREATE_DOC_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      // 索引已存在或其他错误，忽略
      console.log("索引创建跳过或失败:", error);
    }
  }

  // 创建agents表
  await db.execute(CREATE_AGENTS_TABLE);

  // 创建agent_tools表
  await db.execute(CREATE_AGENT_TOOLS_TABLE);

  // 创建Agent相关索引
  for (const sql of CREATE_AGENTS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      console.log("Agent索引创建跳过或失败:", error);
    }
  }

  // 创建 user_skills 表
  await db.execute(CREATE_USER_SKILLS_TABLE);

  // 创建 agent_skills 表
  await db.execute(CREATE_AGENT_SKILLS_TABLE);

  // 创建 user_api_keys 表
  await db.execute(CREATE_USER_API_KEYS_TABLE);

  // 创建 Skill 相关索引
  for (const sql of CREATE_SKILLS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      console.log("Skill 索引创建跳过或失败:", error);
    }
  }

  // 创建 API Key 相关索引
  for (const sql of CREATE_API_KEYS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      console.log("API Key 索引创建跳过或失败:", error);
    }
  }
}

/**
 * 执行数据库迁移
 * 为现有数据库添加新字段
 */
export async function migrateDatabase(): Promise<void> {
  const db = getDb();

  // 迁移1：添加 agent_id 字段
  try {
    await db.execute(MIGRATION_ADD_AGENT_ID);
    console.log("数据库迁移成功：已添加 agent_id 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("agent_id 字段已存在，跳过迁移");
    } else {
      console.error("数据库迁移失败:", error);
    }
  }

  // 迁移2：添加 is_private 字段
  try {
    await db.execute(MIGRATION_ADD_IS_PRIVATE);
    console.log("数据库迁移成功：已添加 is_private 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("is_private 字段已存在，跳过迁移");
    } else {
      console.error("数据库迁移失败:", error);
    }
  }

  // 迁移3：确保users表存在
  try {
    await db.execute(CREATE_USERS_TABLE);
    console.log("users 表已创建或已存在");
  } catch (error) {
    console.error("创建 users 表失败:", error);
  }

  // 迁移4：创建user_models表
  try {
    await db.execute(CREATE_USER_MODELS_TABLE);
    console.log("user_models 表已创建或已存在");
  } catch (error) {
    console.error("创建 user_models 表失败:", error);
  }

  // 迁移5：创建user_models索引
  for (const sql of CREATE_USER_MODEL_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("索引已存在，跳过");
      } else {
        console.error("创建索引失败:", error);
      }
    }
  }

  // 迁移6：创建user_mcp_servers表
  try {
    await db.execute(CREATE_USER_MCP_SERVERS_TABLE);
    console.log("user_mcp_servers 表已创建或已存在");
  } catch (error) {
    console.error("创建 user_mcp_servers 表失败:", error);
  }

  // 迁移7：创建mcp_tools表
  try {
    await db.execute(CREATE_MCP_TOOLS_TABLE);
    console.log("mcp_tools 表已创建或已存在");
  } catch (error) {
    console.error("创建 mcp_tools 表失败:", error);
  }

  // 迁移8：创建MCP服务器相关索引
  for (const sql of CREATE_MCP_SERVERS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("MCP索引已存在，跳过");
      } else {
        console.error("创建MCP索引失败:", error);
      }
    }
  }

  // 迁移9：创建agents表
  try {
    await db.execute(CREATE_AGENTS_TABLE);
    console.log("agents 表已创建或已存在");
  } catch (error) {
    console.error("创建 agents 表失败:", error);
  }

  // 迁移10：创建agent_tools表
  try {
    await db.execute(CREATE_AGENT_TOOLS_TABLE);
    console.log("agent_tools 表已创建或已存在");
  } catch (error) {
    console.error("创建 agent_tools 表失败:", error);
  }

  // 迁移11：创建Agent相关索引
  for (const sql of CREATE_AGENTS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("Agent索引已存在，跳过");
      } else {
        console.error("创建Agent索引失败:", error);
      }
    }
  }

  // 迁移12：添加source字段
  try {
    await db.execute(MIGRATION_ADD_SOURCE);
    console.log("数据库迁移成功：已添加 source 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("source 字段已存在，跳过迁移");
    } else {
      console.error("数据库迁移失败:", error);
    }
  }

  // 迁移: 创建 user_skills 表
  try {
    await db.execute(CREATE_USER_SKILLS_TABLE);
    console.log("user_skills 表已创建或已存在");
  } catch (error) {
    console.error("创建 user_skills 表失败:", error);
  }

  // 迁移: 创建 agent_skills 表
  try {
    await db.execute(CREATE_AGENT_SKILLS_TABLE);
    console.log("agent_skills 表已创建或已存在");
  } catch (error) {
    console.error("创建 agent_skills 表失败:", error);
  }

  // 迁移: 创建 user_api_keys 表
  try {
    await db.execute(CREATE_USER_API_KEYS_TABLE);
    console.log("user_api_keys 表已创建或已存在");
  } catch (error) {
    console.error("创建 user_api_keys 表失败:", error);
  }

  // 迁移: 创建 Skill 相关索引
  for (const sql of CREATE_SKILLS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("Skill 索引已存在，跳过");
      } else {
        console.error("创建 Skill 索引失败:", error);
      }
    }
  }

  // 迁移: 创建 API Key 相关索引
  for (const sql of CREATE_API_KEYS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("API Key 索引已存在，跳过");
      } else {
        console.error("创建 API Key 索引失败:", error);
      }
    }
  }

  // 迁移：为 user_models 添加 context_limit 字段
  try {
    await db.execute(MIGRATION_ADD_CONTEXT_LIMIT);
    console.log("数据库迁移成功：已添加 context_limit 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("context_limit 字段已存在，跳过迁移");
    } else {
      console.error("数据库迁移失败:", error);
    }
  }

  // 迁移：创建 deleted_messages 归档表
  try {
    await db.execute(CREATE_DELETED_MESSAGES_TABLE);
    console.log("deleted_messages 表已创建或已存在");
  } catch (error) {
    console.error("创建 deleted_messages 表失败:", error);
  }

  // 迁移：创建归档表索引
  for (const sql of CREATE_DELETED_MESSAGES_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("归档表索引已存在，跳过");
      } else {
        console.error("创建归档表索引失败:", error);
      }
    }
  }

  // 迁移：为 messages 表添加 token 统计字段
  // 注意：SQLite 每条 ALTER TABLE 只能添加一个字段
  try {
    await db.execute(`ALTER TABLE messages ADD COLUMN input_tokens INTEGER`);
    console.log("数据库迁移成功：已添加 messages.input_tokens 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("messages.input_tokens 字段已存在，跳过迁移");
    } else {
      console.error("添加 messages.input_tokens 字段失败:", error);
    }
  }

  try {
    await db.execute(`ALTER TABLE messages ADD COLUMN output_tokens INTEGER`);
    console.log("数据库迁移成功：已添加 messages.output_tokens 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("messages.output_tokens 字段已存在，跳过迁移");
    } else {
      console.error("添加 messages.output_tokens 字段失败:", error);
    }
  }

  try {
    await db.execute(`ALTER TABLE messages ADD COLUMN total_tokens INTEGER`);
    console.log("数据库迁移成功：已添加 messages.total_tokens 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("messages.total_tokens 字段已存在，跳过迁移");
    } else {
      console.error("添加 messages.total_tokens 字段失败:", error);
    }
  }

  // 迁移：为 conversations 表添加 token 汇总字段
  try {
    await db.execute(`ALTER TABLE conversations ADD COLUMN total_input_tokens INTEGER DEFAULT 0`);
    console.log("数据库迁移成功：已添加 conversations.total_input_tokens 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("conversations.total_input_tokens 字段已存在，跳过迁移");
    } else {
      console.error("添加 conversations.total_input_tokens 字段失败:", error);
    }
  }

  try {
    await db.execute(`ALTER TABLE conversations ADD COLUMN total_output_tokens INTEGER DEFAULT 0`);
    console.log("数据库迁移成功：已添加 conversations.total_output_tokens 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("conversations.total_output_tokens 字段已存在，跳过迁移");
    } else {
      console.error("添加 conversations.total_output_tokens 字段失败:", error);
    }
  }

  try {
    await db.execute(`ALTER TABLE conversations ADD COLUMN total_tokens INTEGER DEFAULT 0`);
    console.log("数据库迁移成功：已添加 conversations.total_tokens 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("conversations.total_tokens 字段已存在，跳过迁移");
    } else {
      console.error("添加 conversations.total_tokens 字段失败:", error);
    }
  }

  // 迁移：为 conversations 表添加 compression_cache 字段
  try {
    await db.execute(MIGRATION_ADD_COMPRESSION_CACHE);
    console.log("数据库迁移成功：已添加 compression_cache 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("compression_cache 字段已存在，跳过迁移");
    } else {
      console.error("添加 compression_cache 字段失败:", error);
    }
  }

  // 迁移：为 messages 表添加 type 字段
  try {
    await db.execute(MIGRATION_ADD_MESSAGE_TYPE);
    console.log("数据库迁移成功：已添加 messages.type 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("messages.type 字段已存在，跳过迁移");
    } else {
      console.error("添加 messages.type 字段失败:", error);
    }
  }

  // 迁移：创建压缩任务表
  try {
    await db.execute(CREATE_COMPRESSION_TASKS_TABLE);
    console.log("compression_tasks 表已创建或已存在");
  } catch (error) {
    console.error("创建 compression_tasks 表失败:", error);
  }

  // 迁移：创建压缩任务索引
  for (const sql of CREATE_COMPRESSION_TASKS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("压缩任务索引已存在，跳过");
      } else {
        console.error("创建压缩任务索引失败:", error);
      }
    }
  }

  // 迁移：创建检查点表
  try {
    await db.execute(CREATE_CHECKPOINTS_TABLE);
    console.log("checkpoints 表已创建或已存在");
  } catch (error) {
    console.error("创建 checkpoints 表失败:", error);
  }

  // 迁移：为 checkpoints 表添加 cache_content 字段
  try {
    await db.execute(MIGRATION_ADD_CHECKPOINT_CACHE_CONTENT);
    console.log("数据库迁移成功：已添加 checkpoints.cache_content 字段");
  } catch (error) {
    if (String(error).includes("duplicate column")) {
      console.log("checkpoints.cache_content 字段已存在，跳过迁移");
    } else {
      console.error("添加 checkpoints.cache_content 字段失败:", error);
    }
  }

  // 迁移：创建检查点索引
  for (const sql of CREATE_CHECKPOINTS_INDEXES) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("检查点索引已存在，跳过");
      } else {
        console.error("创建检查点索引失败:", error);
      }
    }
  }
}

/**
 * 检查数据库是否已初始化
 * 通过检查conversations表是否存在来判断
 */
export async function isDatabaseInitialized(): Promise<boolean> {
  const db = getDb();

  try {
    // 查询conversations表是否存在
    const result = await db.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='conversations'
    `);

    return result.rows.length > 0;
  } catch {
    return false;
  }
}

// 导出数据库客户端
export { getDb, resetDb } from "./client";

// 导出schema类型和常量（从schemas目录导入）
export * from "@/lib/schemas";

// 导出用户数据访问方法
export * from "./users";

// 导出对话数据访问方法
export * from "./conversations";

// 导出消息数据访问方法
export * from "./messages";

// 导出文件夹数据访问方法
export * from "./folders";

// 导出文档数据访问方法
export * from "./documents";

// 导出用户模型数据访问方法
export * from "./user-models";

// 导出Agent数据访问方法
export * from "./agents";

// 导出 Skill 数据访问方法
export * from "./skills";

// 导出 API Key 数据访问方法
export * from "./api-keys";

// 导出消息撤回数据访问方法
export * from "./message-retract";
