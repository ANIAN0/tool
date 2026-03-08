/**
 * 数据库结构检查脚本
 * 用于分析数据库现有表结构，识别潜在的无用字段和表
 *
 * 执行方式：npx tsx scripts/analyze-db.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import * as fs from "fs";

// 加载环境变量
config({ path: resolve(__dirname, "../.env") });

import { getDb } from "../lib/db/client";

/**
 * 获取所有表名
 */
async function getAllTables(): Promise<string[]> {
  const db = getDb();
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  return result.rows.map((row) => row.name as string);
}

/**
 * 获取表的列信息
 */
async function getTableColumns(
  tableName: string
): Promise<Array<{ name: string; type: string; notnull: number; dflt_value: unknown }>> {
  const db = getDb();
  const result = await db.execute(`PRAGMA table_info(${tableName})`);
  return result.rows.map((row) => ({
    name: row.name as string,
    type: row.type as string,
    notnull: row.notnull as number,
    dflt_value: row.dflt_value,
  }));
}

/**
 * 获取表的索引信息
 */
async function getTableIndexes(
  tableName: string
): Promise<Array<{ name: string; unique: number }>> {
  const db = getDb();
  const result = await db.execute(`PRAGMA index_list(${tableName})`);
  return result.rows.map((row) => ({
    name: row.name as string,
    unique: row.unique as number,
  }));
}

/**
 * 获取表的外键信息
 */
async function getTableForeignKeys(
  tableName: string
): Promise<
  Array<{
    id: number;
    seq: number;
    table: string;
    from: string;
    to: string;
    on_update: string;
    on_delete: string;
    match: string;
  }>
> {
  const db = getDb();
  const result = await db.execute(`PRAGMA foreign_key_list(${tableName})`);
  return result.rows.map((row) => ({
    id: row.id as number,
    seq: row.seq as number,
    table: row.table as string,
    from: row.from as string,
    to: row.to as string,
    on_update: row.on_update as string,
    on_delete: row.on_delete as string,
    match: row.match as string,
  }));
}

/**
 * 获取表的数据行数
 */
async function getTableRowCount(tableName: string): Promise<number> {
  const db = getDb();
  const result = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
  return (result.rows[0]?.count as number) || 0;
}

/**
 * 检查字段是否可能无用（所有值为NULL或默认值）
 */
async function checkColumnUsage(
  tableName: string,
  columnName: string
): Promise<{ nullCount: number; distinctCount: number }> {
  const db = getDb();

  // 检查NULL值数量
  const nullResult = await db.execute(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE ${columnName} IS NULL`
  );
  const nullCount = (nullResult.rows[0]?.count as number) || 0;

  // 检查不同值数量
  const distinctResult = await db.execute(
    `SELECT COUNT(DISTINCT ${columnName}) as count FROM ${tableName} WHERE ${columnName} IS NOT NULL`
  );
  const distinctCount = (distinctResult.rows[0]?.count as number) || 0;

  return { nullCount, distinctCount };
}

/**
 * 生成分析报告
 */
async function generateReport(): Promise<string> {
  console.log("=== 开始数据库结构分析 ===\n");

  const tables = await getAllTables();
  console.log(`发现 ${tables.length} 个表：${tables.join(", ")}\n`);

  let report = `# 数据库结构分析报告\n\n`;
  report += `分析时间：${new Date().toLocaleString("zh-CN")}\n\n`;

  // 1. 数据库概览
  report += `## 一、数据库概览\n\n`;
  report += `- **数据库类型**: Turso (SQLite)\n`;
  report += `- **表总数**: ${tables.length}\n`;
  report += `- **表列表**: ${tables.join(", ")}\n\n`;

  // 2. 各表结构详情
  report += `## 二、表结构详情\n\n`;

  const tableAnalysis: Array<{
    name: string;
    columns: number;
    rows: number;
    indexes: number;
    foreignKeys: number;
    columnDetails: Array<{
      name: string;
      type: string;
      notnull: boolean;
      dflt_value: unknown;
    }>;
  }> = [];

  for (const tableName of tables) {
    console.log(`正在分析表: ${tableName}...`);

    const columns = await getTableColumns(tableName);
    const indexes = await getTableIndexes(tableName);
    const foreignKeys = await getTableForeignKeys(tableName);
    const rowCount = await getTableRowCount(tableName);

    tableAnalysis.push({
      name: tableName,
      columns: columns.length,
      rows: rowCount,
      indexes: indexes.length,
      foreignKeys: foreignKeys.length,
      columnDetails: columns.map((c) => ({
        name: c.name,
        type: c.type,
        notnull: Boolean(c.notnull),
        dflt_value: c.dflt_value,
      })),
    });

    // 表基本信息
    report += `### 2.${tableAnalysis.length} ${tableName} 表\n\n`;
    report += `| 属性 | 值 |\n`;
    report += `|------|------|\n`;
    report += `| 列数 | ${columns.length} |\n`;
    report += `| 数据行数 | ${rowCount} |\n`;
    report += `| 索引数 | ${indexes.length} |\n`;
    report += `| 外键数 | ${foreignKeys.length} |\n\n`;

    // 列详情
    report += `**列结构**：\n\n`;
    report += `| 列名 | 类型 | 非空 | 默认值 |\n`;
    report += `|------|------|------|--------|\n`;
    for (const col of columns) {
      const notNullStr = col.notnull ? "是" : "否";
      const defaultStr = col.dflt_value !== null ? String(col.dflt_value) : "NULL";
      report += `| ${col.name} | ${col.type} | ${notNullStr} | ${defaultStr} |\n`;
    }
    report += `\n`;

    // 索引信息
    if (indexes.length > 0) {
      report += `**索引列表**：\n\n`;
      report += `| 索引名 | 是否唯一 |\n`;
      report += `|--------|----------|\n`;
      for (const idx of indexes) {
        report += `| ${idx.name} | ${idx.unique ? "是" : "否"} |\n`;
      }
      report += `\n`;
    }

    // 外键信息
    if (foreignKeys.length > 0) {
      report += `**外键约束**：\n\n`;
      report += `| 当前表字段 | 引用表 | 引用字段 | 删除行为 |\n`;
      report += `|------------|--------|----------|----------|\n`;
      for (const fk of foreignKeys) {
        report += `| ${fk.from} | ${fk.table} | ${fk.to} | ${fk.on_delete} |\n`;
      }
      report += `\n`;
    }
  }

  // 3. 无用表分析
  report += `## 三、无用表分析\n\n`;

  const emptyTables = tableAnalysis.filter((t) => t.rows === 0);
  if (emptyTables.length > 0) {
    report += `### 3.1 空表（无数据）\n\n`;
    report += `以下表当前没有数据，建议确认是否需要保留：\n\n`;
    report += `| 表名 | 列数 | 说明 |\n`;
    report += `|------|------|------|\n`;
    for (const t of emptyTables) {
      report += `| ${t.name} | ${t.columns} | 当前无数据 |\n`;
    }
    report += `\n`;
  } else {
    report += `✅ 未发现空表，所有表都有数据。\n\n`;
  }

  // 4. 无用字段分析
  report += `## 四、无用字段分析\n\n`;

  console.log("\n正在分析字段使用情况...");

  const potentialUnusedFields: Array<{
    table: string;
    column: string;
    type: string;
    nullCount: number;
    totalRows: number;
    reason: string;
  }> = [];

  for (const table of tableAnalysis) {
    if (table.rows === 0) continue;

    for (const col of table.columnDetails) {
      // 跳过主键字段
      if (col.name === "id") continue;

      console.log(`  检查 ${table.name}.${col.name}...`);

      const usage = await checkColumnUsage(table.name, col.name);

      // 如果所有值都是NULL，标记为潜在无用字段
      if (usage.nullCount === table.rows) {
        potentialUnusedFields.push({
          table: table.name,
          column: col.name,
          type: col.type,
          nullCount: usage.nullCount,
          totalRows: table.rows,
          reason: "所有记录该字段值均为NULL",
        });
      }
      // 如果只有一个唯一值且不是NULL，标记为潜在无用字段（可能是常量）
      else if (usage.distinctCount === 1 && usage.nullCount === 0) {
        potentialUnusedFields.push({
          table: table.name,
          column: col.name,
          type: col.type,
          nullCount: usage.nullCount,
          totalRows: table.rows,
          reason: "所有记录该字段值相同（可能是常量）",
        });
      }
    }
  }

  if (potentialUnusedFields.length > 0) {
    report += `### 4.1 潜在无用字段\n\n`;
    report += `以下字段可能存在使用问题，建议检查：\n\n`;
    report += `| 表名 | 字段名 | 类型 | 总记录数 | NULL数 | 原因 |\n`;
    report += `|------|--------|------|----------|--------|------|\n`;
    for (const field of potentialUnusedFields) {
      report += `| ${field.table} | ${field.column} | ${field.type} | ${field.totalRows} | ${field.nullCount} | ${field.reason} |\n`;
    }
    report += `\n`;
  } else {
    report += `✅ 未发现明显的无用字段。\n\n`;
  }

  // 5. 优化建议
  report += `## 五、优化建议\n\n`;

  // 5.1 索引优化建议
  report += `### 5.1 索引优化\n\n`;
  const tablesWithoutIndexes = tableAnalysis.filter((t) => t.indexes === 0);
  if (tablesWithoutIndexes.length > 0) {
    report += `以下表没有索引，如果数据量增大可能影响查询性能：\n\n`;
    for (const t of tablesWithoutIndexes) {
      report += `- **${t.name}**: 当前 ${t.rows} 行数据\n`;
    }
    report += `\n建议为经常查询的字段添加索引。\n\n`;
  } else {
    report += `✅ 所有表都有适当的索引。\n\n`;
  }

  // 5.2 数据完整性建议
  report += `### 5.2 数据完整性\n\n`;
  report += `- 定期检查外键约束的一致性\n`;
  report += `- 监控表的数据增长情况\n`;
  report += `- 及时清理已删除对话的孤立消息\n\n`;

  // 6. 总结
  report += `## 六、总结\n\n`;
  report += `| 项目 | 数量 |\n`;
  report += `|------|------|\n`;
  report += `| 总表数 | ${tables.length} |\n`;
  report += `| 空表数 | ${emptyTables.length} |\n`;
  report += `| 潜在无用字段数 | ${potentialUnusedFields.length} |\n`;
  report += `| 总记录数 | ${tableAnalysis.reduce((sum, t) => sum + t.rows, 0)} |\n\n`;

  report += `---\n`;
  report += `*报告生成时间：${new Date().toLocaleString("zh-CN")}*\n`;

  return report;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    const report = await generateReport();

    // 保存报告到文件
    const reportPath = resolve(__dirname, "../docs/数据库结构分析报告.md");
    fs.writeFileSync(reportPath, report, "utf-8");

    console.log(`\n✅ 分析报告已生成：${reportPath}`);
    process.exit(0);
  } catch (error) {
    console.error("\n❌ 分析失败:", error);
    process.exit(1);
  }
}

main();
