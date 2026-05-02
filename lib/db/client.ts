import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Database } from "@tursodatabase/sync";
import type { DatabaseOpts } from "@tursodatabase/sync";

type DbMode = "cloud" | "local";
type SqlArg = null | string | number | bigint | boolean | ArrayBuffer | Uint8Array | Date;
type SqlArgs = SqlArg[] | Record<string, SqlArg>;
type InStatement = string | { sql: string; args?: SqlArgs };
type ResultRow = Record<string, unknown> & { length?: number; [index: number]: unknown };

export interface TursoResultSet {
  columns: string[];
  columnTypes: string[];
  rows: ResultRow[];
  rowsAffected: number;
  lastInsertRowid: bigint | undefined;
  toJSON(): Omit<TursoResultSet, "toJSON">;
}

export interface TursoClient {
  execute(stmt: InStatement): Promise<TursoResultSet>;
  execute(sql: string, args?: SqlArgs): Promise<TursoResultSet>;
  batch(stmts: Array<InStatement | [string, SqlArgs?]>): Promise<TursoResultSet[]>;
  migrate(stmts: InStatement[]): Promise<TursoResultSet[]>;
  executeMultiple(sql: string): Promise<void>;
  pull(): Promise<boolean>;
  push(): Promise<void>;
  close(): Promise<void>;
}

let db: TursoClient | null = null;

class TursoCompatClient implements TursoClient {
  private readonly database: Database;
  private connectPromise: Promise<void> | null = null;

  constructor(options: DatabaseOpts) {
    this.database = new Database(options);
  }

  async execute(stmt: InStatement): Promise<TursoResultSet>;
  async execute(sql: string, args?: SqlArgs): Promise<TursoResultSet>;
  async execute(stmtOrSql: InStatement, args?: SqlArgs): Promise<TursoResultSet> {
    const stmt = normalizeStatement(stmtOrSql, args);
    return this.executeNormalized(stmt);
  }

  async batch(stmts: Array<InStatement | [string, SqlArgs?]>): Promise<TursoResultSet[]> {
    await this.ensureConnected();

    const results: TursoResultSet[] = [];
    const transaction = this.database.transaction(async () => {
      for (const stmt of stmts) {
        results.push(await this.executeNormalized(normalizeStatementInput(stmt)));
      }
    });

    await transaction();
    return results;
  }

  async migrate(stmts: InStatement[]): Promise<TursoResultSet[]> {
    return this.batch(stmts);
  }

  async executeMultiple(sql: string): Promise<void> {
    await this.ensureConnected();
    await this.database.exec(sql);
  }

  async pull(): Promise<boolean> {
    await this.ensureConnected();
    return this.database.pull();
  }

  async push(): Promise<void> {
    await this.ensureConnected();
    await this.database.push();
  }

  async close(): Promise<void> {
    await this.database.close();
    this.connectPromise = null;
  }

  private async ensureConnected(): Promise<void> {
    // connect() 是异步的，但项目现有 getDb() 是同步 API，所以把连接延迟到首次查询时完成。
    this.connectPromise ??= this.database.connect();
    await this.connectPromise;
  }

  private async executeNormalized(stmt: { sql: string; args?: SqlArgs }): Promise<TursoResultSet> {
    await this.ensureConnected();

    const prepared = this.database.prepare(stmt.sql);
    const args = stmt.args;

    // Turso 的 run() 不返回查询行；含 RETURNING 的写语句也必须走 all() 才能保留现有调用方读取 rows 的行为。
    if (returnsRows(stmt.sql)) {
      const rows = args === undefined ? await prepared.all() : await prepared.all(args);
      return toResultSet(rows, 0, undefined);
    }

    const result = args === undefined ? await prepared.run() : await prepared.run(args);
    return toResultSet([], result.changes, toBigInt(result.lastInsertRowid));
  }
}

export function getDb(): TursoClient {
  if (db) {
    return db;
  }

  const options = getDatabaseOptions();
  ensureParentDir(options.path);
  db = new TursoCompatClient(options);
  return db;
}

export function resetDb(): void {
  db = null;
}

function getDatabaseOptions(): DatabaseOpts {
  const mode = getDbMode();
  const path = resolveDbPath(
    mode === "local"
      ? process.env.TURSO_LOCAL_DATABASE_PATH || "data/turso-local.db"
      : process.env.TURSO_SYNC_DATABASE_PATH || "data/turso-cloud.db"
  );

  if (mode === "local") {
    const localSyncUrl = process.env.TURSO_LOCAL_SYNC_URL;
    return {
      path,
      ...(localSyncUrl ? { url: localSyncUrl } : {}),
      ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
      ...getLongPollOption(),
    };
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("缺少环境变量: TURSO_DATABASE_URL");
  }

  if (!authToken) {
    throw new Error("缺少环境变量: TURSO_AUTH_TOKEN");
  }

  return {
    path,
    url,
    authToken,
    ...getLongPollOption(),
  };
}

function getDbMode(): DbMode {
  const mode = (process.env.TURSO_DATABASE_MODE || "cloud").toLowerCase();

  if (mode === "cloud" || mode === "local") {
    return mode;
  }

  throw new Error("TURSO_DATABASE_MODE 只能设置为 cloud 或 local");
}

function getLongPollOption(): Pick<DatabaseOpts, "longPollTimeoutMs"> {
  const value = process.env.TURSO_SYNC_LONG_POLL_TIMEOUT_MS;

  if (!value) {
    return {};
  }

  const longPollTimeoutMs = Number(value);

  if (!Number.isFinite(longPollTimeoutMs) || longPollTimeoutMs < 0) {
    throw new Error("TURSO_SYNC_LONG_POLL_TIMEOUT_MS 必须是非负数字");
  }

  return { longPollTimeoutMs };
}

function normalizeStatement(stmtOrSql: InStatement, args?: SqlArgs): { sql: string; args?: SqlArgs } {
  if (typeof stmtOrSql === "string") {
    return args === undefined ? { sql: stmtOrSql } : { sql: stmtOrSql, args };
  }

  return stmtOrSql.args === undefined ? { sql: stmtOrSql.sql } : { sql: stmtOrSql.sql, args: stmtOrSql.args };
}

function normalizeStatementInput(stmt: InStatement | [string, SqlArgs?]): { sql: string; args?: SqlArgs } {
  if (Array.isArray(stmt)) {
    const [sql, args] = stmt;
    return args === undefined ? { sql } : { sql, args };
  }

  return normalizeStatement(stmt);
}

function returnsRows(sql: string): boolean {
  const normalized = sql.trim().toLowerCase();
  return (
    normalized.startsWith("select") ||
    normalized.startsWith("pragma") ||
    normalized.startsWith("with") ||
    normalized.startsWith("explain") ||
    /\breturning\b/i.test(sql)
  );
}

function toResultSet(rows: Array<Record<string, unknown>>, rowsAffected: number, lastInsertRowid: bigint | undefined): TursoResultSet {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const mappedRows = rows.map((row) => toResultRow(row, columns));

  return {
    columns,
    columnTypes: columns.map(() => ""),
    rows: mappedRows,
    rowsAffected,
    lastInsertRowid,
    toJSON() {
      return {
        columns: this.columns,
        columnTypes: this.columnTypes,
        rows: this.rows,
        rowsAffected: this.rowsAffected,
        lastInsertRowid: this.lastInsertRowid,
      };
    },
  };
}

function toResultRow(row: Record<string, unknown>, columns: string[]): ResultRow {
  const result = { ...row, length: columns.length } as ResultRow;

  for (const [index, column] of columns.entries()) {
    result[index] = row[column];
  }

  return result;
}

function toBigInt(value: number | bigint | undefined): bigint | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "bigint" ? value : BigInt(value);
}

function resolveDbPath(path: string): string {
  if (path === ":memory:" || isAbsolute(path)) {
    return path;
  }

  return resolve(/* turbopackIgnore: true */ process.cwd(), path);
}

function ensureParentDir(path: string): void {
  if (path === ":memory:") {
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
}
