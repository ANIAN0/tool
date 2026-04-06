/**
 * 数据库初始化脚本
 * 用于创建数据库表结构和索引
 *
 * 执行方式：npx tsx scripts/init-db.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(__dirname, "../.env") });

import { createClient, type Client } from "@libsql/client";
import {
  CREATE_USERS_TABLE,
  CREATE_CONVERSATIONS_TABLE,
  CREATE_MESSAGES_TABLE,
  CREATE_FOLDERS_TABLE,
  CREATE_DOCUMENTS_TABLE,
  CREATE_INDEXES,
  CREATE_DOC_INDEXES,
  CREATE_USER_MODELS_TABLE,
  CREATE_USER_MODEL_INDEXES,
  CREATE_USER_MCP_SERVERS_TABLE,
  CREATE_MCP_TOOLS_TABLE,
  CREATE_MCP_SERVERS_INDEXES,
  // Agent相关表Schema
  CREATE_AGENTS_TABLE,
  CREATE_AGENT_TOOLS_TABLE,
  CREATE_AGENTS_INDEXES,
  // Skill相关表Schema
  CREATE_USER_SKILLS_TABLE,
  CREATE_AGENT_SKILLS_TABLE,
  CREATE_SKILLS_INDEXES,
  // API Key相关表Schema
  CREATE_USER_API_KEYS_TABLE,
  CREATE_API_KEYS_INDEXES,
  // 消息撤回相关表Schema
  CREATE_DELETED_MESSAGES_TABLE,
  CREATE_DELETED_MESSAGES_INDEXES,
} from "../lib/db/schema";

/**
 * 创建数据库客户端
 */
function createDbClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("缺少环境变量: TURSO_DATABASE_URL");
  }

  if (!authToken) {
    throw new Error("缺少环境变量: TURSO_AUTH_TOKEN");
  }

  return createClient({
    url,
    authToken,
  });
}

/**
 * 初始化数据库表结构
 */
async function initDatabase(db: Client): Promise<void> {
  console.log("开始初始化数据库表结构...\n");

  // 1. 创建 users 表
  console.log("创建 users 表...");
  await db.execute(CREATE_USERS_TABLE);
  console.log("✅ users 表创建成功");

  // 2. 创建 conversations 表
  console.log("创建 conversations 表...");
  await db.execute(CREATE_CONVERSATIONS_TABLE);
  console.log("✅ conversations 表创建成功");

  // 3. 创建 messages 表
  console.log("创建 messages 表...");
  await db.execute(CREATE_MESSAGES_TABLE);
  console.log("✅ messages 表创建成功");

  // 4. 创建 folders 表（文档系统）
  console.log("创建 folders 表...");
  await db.execute(CREATE_FOLDERS_TABLE);
  console.log("✅ folders 表创建成功");

  // 5. 创建 documents 表（文档系统）
  console.log("创建 documents 表...");
  await db.execute(CREATE_DOCUMENTS_TABLE);
  console.log("✅ documents 表创建成功");

  // 6. 创建 user_models 表（用户自定义模型）
  console.log("创建 user_models 表...");
  await db.execute(CREATE_USER_MODELS_TABLE);
  console.log("✅ user_models 表创建成功");

  // 7. 创建 user_mcp_servers 表（MCP服务器管理）
  console.log("创建 user_mcp_servers 表...");
  await db.execute(CREATE_USER_MCP_SERVERS_TABLE);
  console.log("✅ user_mcp_servers 表创建成功");

  // 8. 创建 mcp_tools 表（MCP工具缓存）
  console.log("创建 mcp_tools 表...");
  await db.execute(CREATE_MCP_TOOLS_TABLE);
  console.log("✅ mcp_tools 表创建成功");

  // 9. 创建 agents 表（Agent配置）
  console.log("创建 agents 表...");
  await db.execute(CREATE_AGENTS_TABLE);
  console.log("✅ agents 表创建成功");

  // 10. 创建 agent_tools 表（Agent工具关联）
  console.log("创建 agent_tools 表...");
  await db.execute(CREATE_AGENT_TOOLS_TABLE);
  console.log("✅ agent_tools 表创建成功");

  // 11. 创建 user_skills 表（用户 Skill 元数据）
  console.log("创建 user_skills 表...");
  await db.execute(CREATE_USER_SKILLS_TABLE);
  console.log("✅ user_skills 表创建成功");

  // 12. 创建 agent_skills 表（Agent 与 Skill 关联）
  console.log("创建 agent_skills 表...");
  await db.execute(CREATE_AGENT_SKILLS_TABLE);
  console.log("✅ agent_skills 表创建成功");

  // 13. 创建 user_api_keys 表（用户 API Key）
  console.log("创建 user_api_keys 表...");
  await db.execute(CREATE_USER_API_KEYS_TABLE);
  console.log("✅ user_api_keys 表创建成功");

  // 14. 创建 deleted_messages 表（消息撤回归档）
  console.log("创建 deleted_messages 表...");
  await db.execute(CREATE_DELETED_MESSAGES_TABLE);
  console.log("✅ deleted_messages 表创建成功");

  console.log("\n");
}

/**
 * 创建索引
 */
async function createIndexes(db: Client): Promise<void> {
  console.log("开始创建索引...\n");

  // 创建基础索引
  for (const sql of CREATE_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ 索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      console.log(`⚠️ 索引创建跳过: ${sql.substring(0, 60)}...`);
    }
  }

  // 创建文档系统索引
  for (const sql of CREATE_DOC_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ 文档索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      console.log(`⚠️ 文档索引创建跳过: ${sql.substring(0, 60)}...`);
    }
  }

  // 创建用户模型索引
  for (const sql of CREATE_USER_MODEL_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ 用户模型索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      console.log(`⚠️ 用户模型索引创建跳过: ${sql.substring(0, 60)}...`);
    }
  }

  // 创建MCP服务器相关索引
  for (const sql of CREATE_MCP_SERVERS_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ MCP索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      console.log(`⚠️ MCP索引创建跳过: ${sql.substring(0, 60)}...`);
    }
  }

  // 创建Agent相关索引
  for (const sql of CREATE_AGENTS_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ Agent索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      console.log(`⚠️ Agent索引创建跳过: ${sql.substring(0, 60)}...`);
    }
  }

  // 创建 Skill 相关索引
  for (const sql of CREATE_SKILLS_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ Skill索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      console.log(`⚠️ Skill索引创建跳过: ${sql.substring(0, 60)}...`);
    }
  }

  // 创建 API Key 相关索引
  for (const sql of CREATE_API_KEYS_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ API Key索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      console.log(`⚠️ API Key索引创建跳过: ${sql.substring(0, 60)}...`);
    }
  }

  // 创建 deleted_messages 相关索引
  for (const sql of CREATE_DELETED_MESSAGES_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ deleted_messages索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      console.log(`⚠️ deleted_messages索引创建跳过: ${sql.substring(0, 60)}...`);
    }
  }

  console.log("\n");
}

/**
 * 检查表是否存在
 */
async function tableExists(db: Client, tableName: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    args: [tableName],
  });
  return result.rows.length > 0;
}

/**
 * 检查字段是否存在
 */
async function columnExists(
  db: Client,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT * FROM pragma_table_info(?) WHERE name = ?",
    args: [tableName, columnName],
  });
  return result.rows.length > 0;
}

/**
 * 执行数据库迁移（添加新字段）
 */
async function migrateDatabase(db: Client): Promise<void> {
  console.log("开始执行数据库迁移...\n");

  // 迁移1: 添加 agent_id 字段到 conversations 表
  if (await tableExists(db, "conversations")) {
    if (!(await columnExists(db, "conversations", "agent_id"))) {
      console.log("添加 agent_id 字段到 conversations 表...");
      await db.execute(
        "ALTER TABLE conversations ADD COLUMN agent_id TEXT DEFAULT 'production'"
      );
      console.log("✅ agent_id 字段添加成功");
    } else {
      console.log("✅ agent_id 字段已存在，跳过迁移");
    }
  }

  // 迁移2: 添加 is_private 字段到 conversations 表
  if (await tableExists(db, "conversations")) {
    if (!(await columnExists(db, "conversations", "is_private"))) {
      console.log("添加 is_private 字段到 conversations 表...");
      await db.execute(
        "ALTER TABLE conversations ADD COLUMN is_private INTEGER DEFAULT 0"
      );
      console.log("✅ is_private 字段添加成功");
    } else {
      console.log("✅ is_private 字段已存在，跳过迁移");
    }
  }

  // 迁移3: 添加 folder_id 字段到 documents 表（如果不存在）
  if (await tableExists(db, "documents")) {
    if (!(await columnExists(db, "documents", "folder_id"))) {
      console.log("添加 folder_id 字段到 documents 表...");
      await db.execute(
        "ALTER TABLE documents ADD COLUMN folder_id TEXT"
      );
      console.log("✅ folder_id 字段添加成功");
    } else {
      console.log("✅ folder_id 字段已存在，跳过迁移");
    }
  }

  // 迁移4: 添加 user_id 字段到 documents 表（如果不存在）
  if (await tableExists(db, "documents")) {
    if (!(await columnExists(db, "documents", "user_id"))) {
      console.log("添加 user_id 字段到 documents 表...");
      await db.execute(
        "ALTER TABLE documents ADD COLUMN user_id TEXT NOT NULL DEFAULT 'anonymous'"
      );
      console.log("✅ user_id 字段添加成功");
    } else {
      console.log("✅ user_id 字段已存在，跳过迁移");
    }
  }

  // 迁移5: 创建 user_models 表（如果不存在）
  if (!(await tableExists(db, "user_models"))) {
    console.log("创建 user_models 表...");
    await db.execute(CREATE_USER_MODELS_TABLE);
    console.log("✅ user_models 表创建成功");
  } else {
    console.log("✅ user_models 表已存在，跳过迁移");
  }

  // 迁移6: 创建 user_mcp_servers 表（如果不存在）
  if (!(await tableExists(db, "user_mcp_servers"))) {
    console.log("创建 user_mcp_servers 表...");
    await db.execute(CREATE_USER_MCP_SERVERS_TABLE);
    console.log("✅ user_mcp_servers 表创建成功");
  } else {
    console.log("✅ user_mcp_servers 表已存在，跳过迁移");
  }

  // 迁移7: 创建 mcp_tools 表（如果不存在）
  if (!(await tableExists(db, "mcp_tools"))) {
    console.log("创建 mcp_tools 表...");
    await db.execute(CREATE_MCP_TOOLS_TABLE);
    console.log("✅ mcp_tools 表创建成功");
  } else {
    console.log("✅ mcp_tools 表已存在，跳过迁移");
  }

  // 迁移8: 添加 headers 字段到 user_mcp_servers 表（用于存储自定义请求头）
  if (await tableExists(db, "user_mcp_servers")) {
    if (!(await columnExists(db, "user_mcp_servers", "headers"))) {
      console.log("添加 headers 字段到 user_mcp_servers 表...");
      await db.execute(
        "ALTER TABLE user_mcp_servers ADD COLUMN headers TEXT"
      );
      console.log("✅ headers 字段添加成功");
    } else {
      console.log("✅ headers 字段已存在，跳过迁移");
    }
  }

  // 迁移9: 创建 agents 表（如果不存在）
  if (!(await tableExists(db, "agents"))) {
    console.log("创建 agents 表...");
    await db.execute(CREATE_AGENTS_TABLE);
    console.log("✅ agents 表创建成功");
  } else {
    console.log("✅ agents 表已存在，跳过迁移");
  }

  // 迁移10: 创建 agent_tools 表（如果不存在）
  if (!(await tableExists(db, "agent_tools"))) {
    console.log("创建 agent_tools 表...");
    await db.execute(CREATE_AGENT_TOOLS_TABLE);
    console.log("✅ agent_tools 表创建成功");
  } else {
    console.log("✅ agent_tools 表已存在，跳过迁移");
  }

  // 迁移11: 添加 enabled_system_tools 字段到 agents 表
  // 用于存储 Agent 启用的系统工具ID列表（JSON格式）
  if (await tableExists(db, "agents")) {
    if (!(await columnExists(db, "agents", "enabled_system_tools"))) {
      console.log("添加 enabled_system_tools 字段到 agents 表...");
      await db.execute(
        "ALTER TABLE agents ADD COLUMN enabled_system_tools TEXT"
      );
      console.log("✅ enabled_system_tools 字段添加成功");
    } else {
      console.log("✅ enabled_system_tools 字段已存在，跳过迁移");
    }
  }

  // 迁移12: 创建 user_skills 表（如果不存在）
  if (!(await tableExists(db, "user_skills"))) {
    console.log("创建 user_skills 表...");
    await db.execute(CREATE_USER_SKILLS_TABLE);
    console.log("✅ user_skills 表创建成功");
  } else {
    console.log("✅ user_skills 表已存在，跳过迁移");
  }

  // 迁移13: 创建 agent_skills 表（如果不存在）
  if (!(await tableExists(db, "agent_skills"))) {
    console.log("创建 agent_skills 表...");
    await db.execute(CREATE_AGENT_SKILLS_TABLE);
    console.log("✅ agent_skills 表创建成功");
  } else {
    console.log("✅ agent_skills 表已存在，跳过迁移");
  }

  // 迁移14: 创建 user_api_keys 表（如果不存在）
  if (!(await tableExists(db, "user_api_keys"))) {
    console.log("创建 user_api_keys 表...");
    await db.execute(CREATE_USER_API_KEYS_TABLE);
    console.log("✅ user_api_keys 表创建成功");
  } else {
    console.log("✅ user_api_keys 表已存在，跳过迁移");
  }

  // 迁移15: 创建 Skill 相关索引（如果不存在）
  for (const sql of CREATE_SKILLS_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ Skill索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("✅ Skill索引已存在，跳过");
      } else {
        console.error("创建 Skill 索引失败:", error);
      }
    }
  }

  // 迁移16: 创建 API Key 相关索引（如果不存在）
  for (const sql of CREATE_API_KEYS_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ API Key索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("✅ API Key索引已存在，跳过");
      } else {
        console.error("创建 API Key 索引失败:", error);
      }
    }
  }

  // 迁移17: 添加 file_count 字段到 user_skills 表（用于存储 Skill 目录文件数量）
  if (await tableExists(db, "user_skills")) {
    if (!(await columnExists(db, "user_skills", "file_count"))) {
      console.log("添加 file_count 字段到 user_skills 表...");
      await db.execute(
        "ALTER TABLE user_skills ADD COLUMN file_count INTEGER DEFAULT 1"
      );
      console.log("✅ file_count 字段添加成功");
    } else {
      console.log("✅ file_count 字段已存在，跳过迁移");
    }
  }

  // 迁移18: 添加 context_limit 字段到 user_models 表（模型上下文上限）
  if (await tableExists(db, "user_models")) {
    if (!(await columnExists(db, "user_models", "context_limit"))) {
      console.log("添加 context_limit 字段到 user_models 表...");
      await db.execute(
        "ALTER TABLE user_models ADD COLUMN context_limit INTEGER DEFAULT 32000"
      );
      console.log("✅ context_limit 字段添加成功");
    } else {
      console.log("✅ context_limit 字段已存在，跳过迁移");
    }
  }

  // 迁移19: 添加 token 统计字段到 messages 表
  if (await tableExists(db, "messages")) {
    const messageTokenFields = [
      { name: "input_tokens", sql: "ALTER TABLE messages ADD COLUMN input_tokens INTEGER" },
      { name: "output_tokens", sql: "ALTER TABLE messages ADD COLUMN output_tokens INTEGER" },
      { name: "total_tokens", sql: "ALTER TABLE messages ADD COLUMN total_tokens INTEGER" },
    ];

    for (const field of messageTokenFields) {
      if (!(await columnExists(db, "messages", field.name))) {
        console.log(`添加 ${field.name} 字段到 messages 表...`);
        await db.execute(field.sql);
        console.log(`✅ messages.${field.name} 字段添加成功`);
      } else {
        console.log(`✅ messages.${field.name} 字段已存在，跳过迁移`);
      }
    }
  }

  // 迁移20: 添加 token 汇总字段到 conversations 表
  if (await tableExists(db, "conversations")) {
    const conversationTokenFields = [
      { name: "total_input_tokens", sql: "ALTER TABLE conversations ADD COLUMN total_input_tokens INTEGER DEFAULT 0" },
      { name: "total_output_tokens", sql: "ALTER TABLE conversations ADD COLUMN total_output_tokens INTEGER DEFAULT 0" },
      { name: "total_tokens", sql: "ALTER TABLE conversations ADD COLUMN total_tokens INTEGER DEFAULT 0" },
    ];

    for (const field of conversationTokenFields) {
      if (!(await columnExists(db, "conversations", field.name))) {
        console.log(`添加 ${field.name} 字段到 conversations 表...`);
        await db.execute(field.sql);
        console.log(`✅ conversations.${field.name} 字段添加成功`);
      } else {
        console.log(`✅ conversations.${field.name} 字段已存在，跳过迁移`);
      }
    }
  }

  // 迁移21: 创建 deleted_messages 表（如果不存在）
  if (!(await tableExists(db, "deleted_messages"))) {
    console.log("创建 deleted_messages 表...");
    await db.execute(CREATE_DELETED_MESSAGES_TABLE);
    console.log("✅ deleted_messages 表创建成功");
  } else {
    console.log("✅ deleted_messages 表已存在，跳过迁移");
  }

  // 迁移22: 创建 deleted_messages 相关索引（如果不存在）
  for (const sql of CREATE_DELETED_MESSAGES_INDEXES) {
    try {
      await db.execute(sql);
      console.log(`✅ deleted_messages索引创建成功: ${sql.substring(0, 60)}...`);
    } catch (error) {
      if (String(error).includes("already exists")) {
        console.log("✅ deleted_messages索引已存在，跳过");
      } else {
        console.error("创建 deleted_messages 索引失败:", error);
      }
    }
  }

  // 迁移23: 添加 compression_cache 字段到 conversations 表（会话压缩缓存）
  if (await tableExists(db, "conversations")) {
    if (!(await columnExists(db, "conversations", "compression_cache"))) {
      console.log("添加 compression_cache 字段到 conversations 表...");
      await db.execute(
        "ALTER TABLE conversations ADD COLUMN compression_cache TEXT"
      );
      console.log("✅ compression_cache 字段添加成功");
    } else {
      console.log("✅ compression_cache 字段已存在，跳过迁移");
    }
  }

  // 迁移24: 添加 type 字段到 messages 表（消息类型：normal/checkpoint）
  if (await tableExists(db, "messages")) {
    if (!(await columnExists(db, "messages", "type"))) {
      console.log("添加 type 字段到 messages 表...");
      await db.execute(
        "ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'normal'"
      );
      console.log("✅ messages.type 字段添加成功");
    } else {
      console.log("✅ messages.type 字段已存在，跳过迁移");
    }
  }

  console.log("\n");
}

/**
 * 显示数据库状态
 */
async function showDatabaseStatus(db: Client): Promise<void> {
  console.log("=== 数据库状态 ===\n");

  const tables = [
    "users",
    "conversations",
    "messages",
    "folders",
    "documents",
    "user_models",
    "user_mcp_servers",
    "mcp_tools",
    "agents",
    "agent_tools",
    "user_skills",
    "agent_skills",
    "user_api_keys",
    "deleted_messages",
  ];

  for (const table of tables) {
    const exists = await tableExists(db, table);
    if (exists) {
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM ${table}`,
        args: [],
      });
      const count = Number(countResult.rows[0]?.count || 0);
      console.log(`✅ ${table}: 存在 (${count} 条记录)`);
    } else {
      console.log(`❌ ${table}: 不存在`);
    }
  }

  console.log("\n");
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("=====================================");
  console.log("     数据库初始化与迁移工具");
  console.log("=====================================\n");

  let db: Client | null = null;

  try {
    // 创建数据库连接
    db = createDbClient();
    console.log("✅ 数据库连接成功\n");

    // 获取命令行参数
    const args = process.argv.slice(2);
    const command = args[0] || "all";

    switch (command) {
      case "init":
        // 仅初始化表结构
        await initDatabase(db);
        await createIndexes(db);
        break;

      case "migrate":
        // 仅执行迁移
        await migrateDatabase(db);
        break;

      case "status":
        // 仅查看状态
        await showDatabaseStatus(db);
        break;

      case "all":
      default:
        // 执行完整流程：初始化 + 迁移 + 状态
        await initDatabase(db);
        await createIndexes(db);
        await migrateDatabase(db);
        await showDatabaseStatus(db);
        break;
    }

    console.log("=====================================");
    console.log("     操作完成！");
    console.log("=====================================");
  } catch (error) {
    console.error("\n❌ 操作失败:", error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    if (db) {
      // @ts-ignore - libsql client 有 close 方法
      await db.close?.();
    }
  }

  process.exit(0);
}

main();
