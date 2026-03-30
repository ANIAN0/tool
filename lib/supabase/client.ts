/**
 * Supabase 客户端配置
 * 用于 Storage 文件存储等服务
 *
 * 密钥说明：
 * - PUBLISHABLE_KEY：公钥，可在客户端使用，受 RLS 策略限制
 * - SECRET_KEY：密钥，只能在服务端使用，绕过 RLS 策略
 */

import { createClient } from "@supabase/supabase-js";

// Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL;

// 支持新旧命名规范
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * 检查 Supabase 是否已配置
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseSecretKey);
}

/**
 * 获取 Supabase 客户端（服务端使用，使用 Secret Key）
 * 用于服务端文件操作，绕过 RLS 策略
 */
export function getSupabaseServerClient() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase 未配置，请设置 SUPABASE_URL 和 SUPABASE_SECRET_KEY 环境变量");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 获取 Supabase 客户端（客户端使用，使用 Publishable Key）
 * 用于客户端文件上传，受 RLS 策略限制
 */
export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase 未配置，请设置 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY 环境变量");
  }

  return createClient(supabaseUrl, supabasePublishableKey);
}

/**
 * Skills Storage Bucket 名称
 */
export const SKILLS_BUCKET = "skills";