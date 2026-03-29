/**
 * Agent详情弹窗组件
 * 展示Agent信息和API对接示例代码
 */

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Agent信息接口（简化版）
 */
interface AgentDetail {
  id: string;
  name: string;
  description?: string | null;
}

/**
 * Agent详情弹窗属性
 */
interface AgentDetailDialogProps {
  // Agent信息
  agent: AgentDetail | null;
  // 弹窗是否打开
  open: boolean;
  // 关闭回调
  onClose: () => void;
}

/**
 * Agent详情弹窗组件
 * 展示Agent基本信息和API对接示例代码
 */
export function AgentDetailDialog({ agent, open, onClose }: AgentDetailDialogProps) {
  // 如果没有选中的Agent，不渲染内容
  if (!agent) return null;

  // 生成API基础URL
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const chatEndpoint = `${apiBaseUrl}/api/v1/chat`;
  const conversationsEndpoint = `${apiBaseUrl}/api/v1/conversations`;

  // 生成curl示例代码
  const codeExample = `// 发送消息给Agent
curl -X POST "${chatEndpoint}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "${agent.id}",
    "message": "你好"
  }'

// 获取历史会话列表
curl -X GET "${conversationsEndpoint}?agent_id=${agent.id}" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  /**
   * 复制示例代码到剪贴板
   */
  const copyToClipboard = () => {
    navigator.clipboard.writeText(codeExample);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        {/* 弹窗标题 */}
        <DialogHeader>
          <DialogTitle>{agent.name} - 接口对接示例</DialogTitle>
          <DialogDescription>
            使用以下示例代码调用该Agent的API接口
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Agent基本信息 */}
          <div>
            <h4 className="font-medium mb-2">Agent信息</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium">ID:</span> {agent.id}</p>
              <p><span className="font-medium">名称:</span> {agent.name}</p>
              <p><span className="font-medium">描述:</span> {agent.description || '暂无描述'}</p>
            </div>
          </div>

          {/* API示例代码 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">接口对接示例</h4>
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                复制代码
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                <pre className="text-xs whitespace-pre-wrap overflow-auto bg-muted p-2 rounded">
                  {codeExample}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}