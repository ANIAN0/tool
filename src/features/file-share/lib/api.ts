import { NextRequest } from 'next/server';
import { writeFile, mkdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

type UploadedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  path: string;
  expiresAt: string;
  uploadedAt: string;
};

const uploadedFiles: UploadedFile[] = [];
const UPLOAD_DIR = join(process.cwd(), 'uploads');

// 确保上传目录存在
async function ensureUploadDir() {
  try {
    await stat(UPLOAD_DIR);
  } catch {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// 清理过期文件的函数
async function cleanupExpiredFiles() {
  const now = new Date();
  const expiredFiles: number[] = [];
  
  // 找出所有过期的文件
  for (let i = 0; i < uploadedFiles.length; i++) {
    if (now > new Date(uploadedFiles[i].expiresAt)) {
      expiredFiles.push(i);
    }
  }
  
  // 从后往前删除，避免索引变化问题
  for (let i = expiredFiles.length - 1; i >= 0; i--) {
    const index = expiredFiles[i];
    const file = uploadedFiles[index];
    
    // 删除物理文件
    try {
      await unlink(file.path);
    } catch (error) {
      console.error(`删除过期文件失败: ${file.path}`, error);
    }
    
    // 从数组中移除
    uploadedFiles.splice(index, 1);
  }
  
  if (expiredFiles.length > 0) {
    console.log(`[${new Date().toISOString()}] 清理了 ${expiredFiles.length} 个过期文件`);
  }
  
  // 输出当前文件数量统计
  console.log(`[${new Date().toISOString()}] 当前活跃文件数量: ${uploadedFiles.length}`);
}

// 启动时立即执行一次清理
cleanupExpiredFiles();

// 定期清理过期文件（每小时执行一次）
const cleanupInterval = setInterval(cleanupExpiredFiles, 60 * 60 * 1000);

// 优雅关闭时清理定时器
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
});

process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
});

// 上传文件
export async function upload(request: NextRequest) {
  try {
    await ensureUploadDir();
    
    const formData = await request.formData();
    const files: UploadedFile[] = [];
    
    // 检查是否有文件上传
    const fileEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith('file'));
    if (fileEntries.length === 0) {
      return Response.json({ error: '未找到上传的文件' }, { status: 400 });
    }
    
    // 处理所有上传的文件
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && typeof value === 'object' && value && 'arrayBuffer' in value) {
        const file = value as unknown as { arrayBuffer: () => Promise<ArrayBuffer>; name?: string; type?: string; size?: number };
        
        // 检查文件大小（限制为100MB）
        if (file.size && file.size > 100 * 1024 * 1024) {
          return Response.json({ error: `文件 ${file.name} 大小超过限制（100MB）` }, { status: 400 });
        }
        
        const fileId = randomUUID();
        const fileName = `${fileId}-${file.name ?? 'file'}`;
        const filePath = join(UPLOAD_DIR, fileName);

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const fileInfo = {
          id: fileId,
          name: file.name ?? fileName,
          type: file.type ?? 'application/octet-stream',
          size: file.size ?? buffer.length,
          url: `/api/tools/file-share?op=download&fileId=${fileId}`,
          path: filePath,
          expiresAt: expiresAt.toISOString(),
          uploadedAt: new Date().toISOString()
        };

        uploadedFiles.push(fileInfo);
        files.push(fileInfo);
      }
    }
    
    if (files.length === 0) {
      return Response.json({ error: '未找到有效的文件' }, { status: 400 });
    }
    
    return Response.json({ 
      message: '文件上传成功',
      files: files
    });
  } catch (error: any) {
    console.error('上传错误:', error);
    return Response.json({ error: `文件上传失败: ${error.message || '未知错误'}` }, { status: 500 });
  }
}

// 下载文件
export async function download(request: NextRequest, context?: { params: Promise<{ fileId: string }> }) {
  let fileId = request.nextUrl.searchParams.get('fileId') || '';
  if (context?.params) {
    const p = await context.params;
    fileId = p.fileId || fileId;
  }
  
  try {
    // 检查文件ID是否存在
    if (!fileId) {
      return Response.json({ error: '缺少文件ID参数' }, { status: 400 });
    }
    
    // 查找文件
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) {
      return Response.json({ error: '文件不存在' }, { status: 404 });
    }
    
    // 检查文件是否过期
    if (new Date() > new Date(file.expiresAt)) {
      // 删除过期文件
      const fileIndex = uploadedFiles.findIndex(f => f.id === fileId);
      if (fileIndex > -1) {
        // 删除物理文件
        try {
          await unlink(file.path);
        } catch (error) {
          console.error(`删除过期文件失败: ${file.path}`, error);
        }
        
        uploadedFiles.splice(fileIndex, 1);
      }
      return Response.json({ error: '文件已过期' }, { status: 410 });
    }
    
    // 读取并返回文件
    const fileBuffer = await readFile(file.path);
    const inline = request.nextUrl.searchParams.get('inline') === '1';
    const body = new Uint8Array(fileBuffer);
    return new Response(body, {
      headers: {
        'Content-Type': file.type,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.name)}"`,
      },
    });
  } catch (error: any) {
    console.error('下载错误:', error);
    return Response.json({ error: `文件下载失败: ${error.message || '未知错误'}` }, { status: 500 });
  }
}

// 删除文件
export async function deleteFile(request: NextRequest, context?: { params: Promise<{ fileId: string }> }) {
  let fileId = request.nextUrl.searchParams.get('fileId') || '';
  if (context?.params) {
    const p = await context.params;
    fileId = p.fileId || fileId;
  }
  
  try {
    // 检查文件ID是否存在
    if (!fileId) {
      return Response.json({ error: '缺少文件ID参数' }, { status: 400 });
    }
    
    // 查找文件
    const fileIndex = uploadedFiles.findIndex(f => f.id === fileId);
    if (fileIndex === -1) {
      return Response.json({ error: '文件不存在' }, { status: 404 });
    }
    
    const file = uploadedFiles[fileIndex];

    // 删除文件记录
    uploadedFiles.splice(fileIndex, 1);
    
    // 删除物理文件
    try {
      await unlink(file.path);
    } catch (error) {
      console.error(`删除物理文件失败: ${file.path}`, error);
      // 即使物理文件删除失败，我们也认为操作成功
    }
    
    return Response.json({ 
      message: '文件删除成功',
      fileId: fileId
    });
  } catch (error: any) {
    console.error('删除错误:', error);
    return Response.json({ error: `文件删除失败: ${error.message || '未知错误'}` }, { status: 500 });
  }
}

// 获取文件列表
export async function list(_request: NextRequest) {
  try {
    // 过滤掉过期文件
    const now = new Date();
    const validFiles = uploadedFiles.filter(file => now <= new Date(file.expiresAt));
    
    return Response.json({ 
      message: '获取文件列表成功',
      files: validFiles
    });
  } catch (error: any) {
    console.error('获取列表错误:', error);
    return Response.json({ error: `获取文件列表失败: ${error.message || '未知错误'}` }, { status: 500 });
  }
}

// 辅助函数：读取文件
async function readFile(filePath: string): Promise<Buffer> {
  const { readFile: fsReadFile } = await import('fs/promises');
  return fsReadFile(filePath);
}

// 默认处理函数
const defaultHandler = async (_request: NextRequest) => {
  return Response.json({ 
    message: '文件分享工具 API',
    endpoints: {
      upload: 'POST /api/tools/file-share?op=upload',
      download: 'GET /api/tools/file-share?op=download&fileId={fileId}',
      delete: 'DELETE /api/tools/file-share?op=deleteFile&fileId={fileId}',
      list: 'GET /api/tools/file-share?op=list'
    }
  });
};

export { defaultHandler as default };