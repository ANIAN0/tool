import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { supabase } from '@/lib/supabase';
import { saveFileToDatabase, getFileFromDatabase, deleteFileFromDatabase, getAllValidFiles, deleteExpiredFiles } from './database';
import sharp from 'sharp';

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

// 上传文件
export async function upload(request: NextRequest) {
  try {
    // 获取认证用户信息
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    let userEmail: string | null = null;
    
    // 尝试从 supabase 获取认证用户（如果有 token）
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { data } = await supabase.auth.getUser();
        userId = data.user?.id ?? null;
        userEmail = data.user?.email ?? null;
      } catch (err) {
        // 忽略认证错误，认为用户未认证
      }
    }
    
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

        const storageFileId = randomUUID();
        const fileName = `${storageFileId}-${file.name ?? 'file'}`;
        const storagePath = `uploads/${storageFileId}/${fileName}`;

        const buffer = Buffer.from(await file.arrayBuffer());

        // 如果是图片，使用 Sharp 压缩
        let finalBuffer: Buffer = buffer;
        const isImage = file.type?.startsWith('image/');
        
        if (isImage && buffer.length > 1 * 1024 * 1024) {
          // 如果图片大于 1MB，压缩处理
          try {
            finalBuffer = await sharp(buffer)
              .resize(2000, 2000, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 70, progressive: true })
              .toBuffer() as Buffer;
            console.log(`图片已压缩: ${buffer.length} → ${finalBuffer.length} bytes`);
          } catch (compressError) {
            console.error('图片压缩失败，使用原文件:', compressError);
            // 压缩失败则使用原文件
          }
        }
        // 上传到 Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('public.files')
          .upload(storagePath, finalBuffer, {
            contentType: file.type || 'application/octet-stream',
          });

        if (uploadError) {
          console.error(`上传文件到 Storage 失败: ${fileName}`, uploadError);
          return Response.json({ error: `上传文件失败: ${uploadError.message}` }, { status: 500 });
        }

        // 计算过期时间：认证用户无需过期（设为 100 年后），匿名用户 24h 后
        let expiresAt: Date;
        if (userId) {
          // 认证用户：设置为 100 年后（实际不会过期）
          expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
        } else {
          // 匿名用户：24 小时后过期
          expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        
        const uploadedAt = new Date();

        const fileInfo = {
          name: file.name ?? fileName,
          type: file.type ?? 'application/octet-stream',
          size: file.size ?? buffer.length,
          url: '', // 之后设置
          path: storagePath,
          expiresAt: expiresAt.toISOString(),
          uploadedAt: uploadedAt.toISOString(),
          userId: userId,  // 传入认证用户 ID
          userEmail: userEmail,  // 传入认证用户邮箱
        };

        // 保存文件信息到数据库，收到返回的 ID
        const dbFileId = await saveFileToDatabase(fileInfo);
        
        const responseFile = {
          id: dbFileId,
          ...fileInfo,
          url: `/api/tools/file-share?op=download&fileId=${dbFileId}`,
        };
        files.push(responseFile);
      }
    }

    if (files.length === 0) {
      return Response.json({ error: '未找到有效的文件' }, { status: 400 });
    }

    return Response.json({
      message: '文件上传成功',
      files: files,
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

  console.log(`处理文件下载请求 - fileId: ${fileId}`);

  try {
    // 检查文件ID是否存在
    if (!fileId) {
      console.log('缺少文件ID参数');
      return Response.json({ error: '缺少文件ID参数' }, { status: 400 });
    }

    // 从数据库查找文件
    const file = await getFileFromDatabase(fileId);
    console.log(`从数据库查找文件 - fileId: ${fileId}, found: ${!!file}`);

    if (!file) {
      console.log(`文件不存在 - fileId: ${fileId}`);
      return Response.json({ error: '文件不存在' }, { status: 404 });
    }

    // 检查文件是否过期（仅检查无认证用户的文件）
    if (file.expires_at && !file.user_id) {
      const now = new Date();
      const expiresAt = new Date(file.expires_at);
      if (now > expiresAt) {
        console.log(`文件已过期 - fileId: ${fileId}`);
        // 删除过期文件
        await deleteFileFromDatabase(fileId);

        // 删除 Storage 中的文件
        try {
          await supabase.storage.from('public.files').remove([file.path]);
          console.log(`成功删除过期文件: ${file.path}`);
        } catch (error) {
          console.error(`删除过期文件失败: ${file.path}`, error);
        }

        return Response.json({ error: '文件已过期' }, { status: 410 });
      }
    }

    // 从 Storage 下载文件
    console.log(`从 Storage 下载文件: ${file.path}`);
    const { data, error } = await supabase.storage
      .from('public.files')
      .download(file.path);

    if (error) {
      console.error(`从 Storage 下载文件失败: ${file.path}`, error);
      return Response.json({ error: `下载文件失败: ${error.message}` }, { status: 500 });
    }

    if (!data) {
      console.log(`Storage 中文件是空的: ${file.path}`);
      return Response.json({ error: '文件内容为Null' }, { status: 404 });
    }

    const blob = data as Blob;
    const arrayBuffer = await blob.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);
    console.log(`成功下载文件内容，大小: ${body.length} bytes`);

    const inline = request.nextUrl.searchParams.get('inline') === '1';

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

    // 从数据库查找文件
    const file = await getFileFromDatabase(fileId);
    if (!file) {
      return Response.json({ error: '文件不存在' }, { status: 404 });
    }

    // 从数据库删除文件记录
    await deleteFileFromDatabase(fileId);

    // 从 Storage 删除文件
    try {
      console.log(`准备删除 Storage 文件: ${file.path}`);
      const { data, error } = await supabase.storage.from('public.files').remove([file.path]);
      
      if (error) {
        console.error(`删除文件失败 (API 错误): ${file.path}`, error);
      } else {
        console.log(`成功删除 Storage 文件: ${file.path}`, data);
      }
    } catch (error) {
      console.error(`删除文件异常: ${file.path}`, error);
      // 即使文件删除失败，我们也认为操作成功
    }

    return Response.json({
      message: '文件删除成功',
      fileId: fileId,
    });
  } catch (error: any) {
    console.error('删除错误:', error);
    return Response.json({ error: `文件删除失败: ${error.message || '未知错误'}` }, { status: 500 });
  }
}

// 获取文件列表
export async function list(_request: NextRequest) {
  try {
    // 第一次丙次调用时，清理过期文件
    try {
      await deleteExpiredFiles();
    } catch (cleanupError) {
      console.error('清理过期文件失败:', cleanupError);
      // 继续执行，不中断
    }

    // 获取所有有效文件
    const validFiles = await getAllValidFiles();

    return Response.json({
      message: '获取文件列表成功',
      files: validFiles,
    });
  } catch (error: any) {
    console.error('获取列表错误:', error);
    return Response.json({ error: `获取文件列表失败: ${error.message || '未知错误'}` }, { status: 500 });
  }
}

// 默认处理函数
const defaultHandler = async (_request: NextRequest) => {
  return Response.json({
    message: '文件分享工具 API',
    endpoints: {
      upload: 'POST /api/tools/file-share?op=upload',
      download: 'GET /api/tools/file-share?op=download&fileId={fileId}',
      delete: 'DELETE /api/tools/file-share?op=deleteFile&fileId={fileId}',
      list: 'GET /api/tools/file-share?op=list',
    },
  });
};

export { defaultHandler as default };