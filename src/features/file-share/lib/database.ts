import { supabase } from '@/lib/supabase';

type FileInfo = {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  expires_at: string;
  created_at: string;
  user_id?: string | null;
  user_email?: string | null;
};

export async function saveFileToDatabase(fileInfo: any) {
  // 使用现有的 public.files 表
  const dbRecord = {
    name: fileInfo.name,
    type: fileInfo.type,
    size: fileInfo.size,
    path: fileInfo.path,
    expires_at: fileInfo.expiresAt,  // 认证用户为 null，匿名用户为 24h 后
    // user_id 和 user_email：如果是认证用户则设置，匿名用户为 null
    user_id: fileInfo.userId || null,
    user_email: fileInfo.userEmail || null,
    public_url: fileInfo.url || '',
  };

  const { data, error } = await supabase
    .from('files')
    .insert([dbRecord])
    .select('id')
    .single();

  if (error) {
    console.error('保存文件到数据库失败:', error);
    throw new Error(`数据库保存失败: ${error.message}`);
  }

  // 返回生成的 ID
  console.log(`文件信息已保存到数据库: ${data?.id}`);
  return data?.id;
}

// 从数据库获取文件信息
export async function getFileFromDatabase(fileId: string): Promise<FileInfo | null> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('从数据库获取文件失败:', error);
    throw new Error(`数据库查询失败: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  // 将数据库字段映射回原格式
  return {
    id: data.id,
    name: data.name,
    type: data.type,
    size: data.size,
    path: data.path,
    expires_at: data.expires_at,
    created_at: data.created_at,
    user_id: data.user_id,
    user_email: data.user_email,
  };
}

// 从数据库删除文件信息
export async function deleteFileFromDatabase(fileId: string): Promise<boolean> {
  const { error } = await supabase.from('files').delete().eq('id', fileId);

  if (error) {
    console.error('从数据库删除文件失败:', error);
    throw new Error(`数据库删除失败: ${error.message}`);
  }

  return true;
}

// 获取所有有效文件（无认证老年即过期，或是脚认证用户上传的）
export async function getAllValidFiles(): Promise<any[]> {
  const now = new Date().toISOString();

  // 条件：(没有脚认证用户 且 未过期) 或 (有脚认证用户)
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .or(`and(user_id.is.null,expires_at.gt.${now}),user_id.not.is.null`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取有效文件列表失败:', error);
    throw new Error(`数据库查询失败: ${error.message}`);
  }

  // 将数据库字段映射为 API 返回格式
  return (data || []).map((file: any) => ({
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    url: `/api/tools/file-share?op=download&fileId=${file.id}`,
    path: file.path,
    expiresAt: file.expires_at,
    uploadedAt: file.created_at,
  }));
}

// 删除所有过期文件（子挺名用户上传的）
export async function deleteExpiredFiles(): Promise<number> {
  const now = new Date().toISOString();

  // 条件：没有脚认证用户 且 已经过期
  const { data: expiredFiles, error: selectError } = await supabase
    .from('files')
    .select('id, path')
    .is('user_id', null)
    .lt('expires_at', now);

  if (selectError) {
    console.error('获取过期文件列表失败:', selectError);
    throw new Error(`数据库查询失败: ${selectError.message}`);
  }

  if (!expiredFiles || expiredFiles.length === 0) {
    return 0;
  }

  // 删除 Storage 中的文件
  for (const file of expiredFiles) {
    try {
      await supabase.storage.from('public.files').remove([file.path]);
    } catch (err) {
      console.error(`删除 Storage 文件失败: ${file.path}`, err);
    }
  }

  // 删除数据库记录
  const { error: deleteError } = await supabase
    .from('files')
    .delete()
    .lt('expires_at', now);

  if (deleteError) {
    console.error('删除过期文件记录失败:', deleteError);
    throw new Error(`数据库删除失败: ${deleteError.message}`);
  }

  console.log(`[${new Date().toISOString()}] 清理了 ${expiredFiles.length} 个过期文件`);
  return expiredFiles.length;
}