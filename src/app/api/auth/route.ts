import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    // 转发请求到认证服务器
    const authResponse = await fetch('http://124.156.205.61:5678/webhook/82a78108-5dbf-47e5-bf41-222ac0b408e3', {
      method: 'GET',
      headers: {
        'password': password
      }
    });
    
    if (authResponse.ok) {
      const result = await authResponse.text();
      if (result === '通过') {
        return Response.json({ authenticated: true });
      } else {
        return Response.json({ authenticated: false, message: result || '认证失败' }, { status: 401 });
      }
    } else {
      return Response.json({ authenticated: false, message: '认证服务不可用' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('认证错误:', error);
    return Response.json({ authenticated: false, message: '认证请求失败' }, { status: 500 });
  }
}