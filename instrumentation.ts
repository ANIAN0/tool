export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDatabase, migrateDatabase, isDatabaseInitialized } = await import("@/lib/db");

    try {
      const initialized = await isDatabaseInitialized();
      if (!initialized) {
        await initDatabase();
        console.log("[instrumentation] 数据库初始化完成");
      }
      await migrateDatabase();
      console.log("[instrumentation] 数据库迁移完成");
    } catch (error) {
      console.error("[instrumentation] 数据库初始化/迁移失败:", error);
    }
  }
}
