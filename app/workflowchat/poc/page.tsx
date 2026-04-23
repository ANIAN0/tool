"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

/**
 * POC 页面 — 验证 useChat 可消费 workflow UIMessageStream
 *
 * 最小实现：用 useChat hook 连接 /api/workflowchat/poc，
 * 显示收到的消息，证明 getReadable() 返回的流与 useChat 兼容。
 */
export default function PocPage() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/workflowchat/poc",
    }),
  });

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16 }}>
        Workflow POC — useChat 消费验证
      </h1>

      {/* 消息列表 */}
      <div style={{ marginBottom: 16, minHeight: 200 }}>
        {messages.length === 0 && (
          <p style={{ color: "#888" }}>暂无消息，点击下方按钮发送。</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: 8,
              padding: 8,
              borderRadius: 4,
              background: msg.role === "user" ? "#e0f0ff" : "#f0f0f0",
            }}
          >
            <strong>{msg.role === "user" ? "用户" : "助手"}：</strong>
            {msg.parts?.map((p, i) =>
              "text" in p ? (
                <span key={i}>{p.text}</span>
              ) : (
                <span key={i}>{JSON.stringify(p)}</span>
              )
            )}
          </div>
        ))}
      </div>

      {/* 发送按钮：POC 不需要真正的输入，触发即可 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage({ text: "POC测试" });
        }}
      >
        <button
          type="submit"
          disabled={status === "streaming" || status === "submitted"}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          {status === "streaming" || status === "submitted"
            ? "流式响应中…"
            : "发送 POC 测试"}
        </button>
      </form>

      {/* 状态指示 */}
      <p style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
        状态：{status}
      </p>
    </div>
  );
}