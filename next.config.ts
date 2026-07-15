import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

// 命名 Agent 使用同源路由：/eve/agents/<agent>/eve/v1/*。
// 页面直接选择目标 Agent，不经过另一个模型驱动的“入口路由”Agent。
export default withEve(nextConfig, {
  agents: {
    assistant: "./agents/assistant",
    research: "./agent",
  },
});
