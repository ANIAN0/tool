// 文件数据库 - 用于在不同工具间共享文件信息
// 在Vercel环境中使用全局对象来保持数据持久性
const getGlobalFileDatabase = () => {
  if (typeof global !== 'undefined' && (global as any).fileDatabase) {
    return (global as any).fileDatabase as Record<string, any>;
  }
  
  if (typeof global !== 'undefined') {
    (global as any).fileDatabase = {};
    return (global as any).fileDatabase;
  }
  
  // 开发环境回退到模块级变量
  return {};
};

export const fileDatabase: Record<string, any> = getGlobalFileDatabase();

// 保存文件信息到数据库
export async function saveFileToDatabase(fileInfo: any) {
  fileDatabase[fileInfo.id] = fileInfo;
  console.log(`文件信息已保存到数据库: ${fileInfo.id}`);
}

// 从数据库获取文件信息
export async function getFileFromDatabase(fileId: string): Promise<any | null> {
  return fileDatabase[fileId] || null;
}

// 从数据库删除文件信息
export async function deleteFileFromDatabase(fileId: string): Promise<boolean> {
  if (fileDatabase[fileId]) {
    delete fileDatabase[fileId];
    return true;
  }
  return false;
}

// 获取所有有效文件
export async function getAllValidFiles(): Promise<any[]> {
  const now = new Date();
  return Object.values(fileDatabase).filter((file: any) => now <= new Date(file.expiresAt));
}