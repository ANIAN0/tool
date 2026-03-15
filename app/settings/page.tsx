/**
 * 设置首页
 * 自动重定向到模型设置页面
 */

import { redirect } from "next/navigation";

/**
 * 设置首页组件
 * 重定向到模型设置页面作为默认设置页
 */
export default function SettingsPage() {
  // 重定向到模型设置页面
  redirect("/settings/models");
}
