import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 定义 params 的类型
type RouteParams = Promise<{ id: string }>;

export async function DELETE(
  request: Request,
  context: { params: Promise<RouteParams> } // 使用正确的类型定义
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 使用 await 获取 params 的值
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { data, error: dbError } = await supabase
      .from('functions')
      .delete()
      .eq('id', id)
      .eq('owner', user.id);

    if (dbError) {
      console.error('[DELETE] Supabase Error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[DELETE] Critical Error:', error);
    return NextResponse.json(
      { success: false, error: "操作失败" },
      { status: 500 }
    );
  }
}