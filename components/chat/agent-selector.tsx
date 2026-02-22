"use client";

/**
 * Agent选择器组件
 * 使用AI Elements的复合组件模式构建Agent选择器
 * 功能点5：Agent选择器组件
 */

import {
  ModelSelector as AgentSelectorDialog,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import { BotIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { getAgentList } from "@/lib/agents/config";

/**
 * AgentSelectorProps
 */
interface AgentSelectorProps {
  // 当前选中的Agent ID
  value?: string;
  // Agent变更回调
  onChange?: (agentId: string) => void;
  // 是否禁用
  disabled?: boolean;
}

/**
 * Agent选择器组件
 * 支持搜索、分组显示
 */
export function AgentSelector({
  value,
  onChange,
  disabled = false,
}: AgentSelectorProps) {
  // 获取所有可用Agent
  const agents = getAgentList();

  // 获取当前选中的Agent
  const selectedAgent = agents.find((a) => a.id === value);

  return (
    <AgentSelectorDialog>
      <ModelSelectorTrigger asChild>
        <Button
          className="gap-1.5 text-sm"
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          {/* 显示当前选中Agent */}
          {selectedAgent ? (
            <>
              <BotIcon className="size-4" />
              <span>{selectedAgent.name}</span>
            </>
          ) : (
            <span>选择Agent</span>
          )}
          <ChevronDownIcon className="size-3.5 opacity-50" />
        </Button>
      </ModelSelectorTrigger>

      <ModelSelectorContent className="sm:max-w-[320px]" title="选择Agent">
        {/* 搜索输入框 */}
        <ModelSelectorInput placeholder="搜索Agent..." />

        <ModelSelectorList>
          {/* 无结果提示 */}
          <ModelSelectorEmpty>未找到匹配的Agent</ModelSelectorEmpty>

          {/* 显示所有Agent */}
          <ModelSelectorGroup heading="可用Agent">
            {agents.map((agent) => (
              <ModelSelectorItem
                className="gap-2"
                key={agent.id}
                onSelect={() => onChange?.(agent.id)}
                value={agent.id}
              >
                {/* Agent图标 */}
                <BotIcon className="size-4 shrink-0 text-muted-foreground" />
                {/* Agent信息 */}
                <ModelSelectorName>
                  <div className="flex items-center gap-1.5">
                    <span>{agent.name}</span>
                  </div>
                  {/* Agent描述 */}
                  {agent.description && (
                    <span className="block text-muted-foreground text-xs">
                      {agent.description}
                    </span>
                  )}
                </ModelSelectorName>
                {/* 选中指示器 */}
                {value === agent.id && (
                  <CheckIcon className="size-4 shrink-0" />
                )}
              </ModelSelectorItem>
            ))}
          </ModelSelectorGroup>
        </ModelSelectorList>
      </ModelSelectorContent>
    </AgentSelectorDialog>
  );
}
