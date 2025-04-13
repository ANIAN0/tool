import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 删除文件
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await context.params
    
    if (!user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 })
    }

    // 先获取文件信息
    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: '未找到文件' }, { status: 404 })
    }
    
    // 检查文件所有权
    if (file.user_id !== user.id) {
      return NextResponse.json({ error: '无权删除此文件' }, { status: 403 })
    }

    // 从存储中删除文件
    const { error: storageError } = await supabase.storage
      .from('public.files')
      .remove([file.path])

    if (storageError) throw storageError

    // 从数据库中删除记录
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', id)

    if (dbError) throw dbError

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('删除文件失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    )
  }
}