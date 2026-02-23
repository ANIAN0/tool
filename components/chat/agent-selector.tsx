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
import { BotIcon, CheckIcon, ChevronDownIcon, LockIcon } from "lucide-react";
import { getAgentList } from "@/lib/agents/config";
import { useAuth } from "@/lib/hooks/use-auth";

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
  // 获取认证状态
  const { isAuthenticated, isLoading } = useAuth();

  // 获取所有可用Agent（根据登录状态过滤）
  const allAgents = getAgentList();
  
  // 公开Agent始终可见，私有Agent仅登录后可见
  const agents = allAgents.filter(
    (agent) => !agent.isPrivate || isAuthenticated
  );

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
              {selectedAgent.isPrivate && (
                <LockIcon className="size-3.5 opacity-50" />
              )}
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

          {/* 显示公开Agent */}
          {allAgents.some((a) => !a.isPrivate) && (
            <ModelSelectorGroup heading="公开Agent">
              {allAgents
                .filter((a) => !a.isPrivate)
                .map((agent) => (
                  <ModelSelectorItem
                    className="gap-2"
                    key={agent.id}
                    onSelect={() => onChange?.(agent.id)}
                    value={agent.id}
                  >
                    <BotIcon className="size-4 shrink-0 text-muted-foreground" />
                    <ModelSelectorName>
                      <div className="flex items-center gap-1.5">
                        <span>{agent.name}</span>
                      </div>
                      {agent.description && (
                        <span className="block text-muted-foreground text-xs">
                          {agent.description}
                        </span>
                      )}
                    </ModelSelectorName>
                    {value === agent.id && (
                      <CheckIcon className="size-4 shrink-0" />
                    )}
                  </ModelSelectorItem>
                ))}
            </ModelSelectorGroup>
          )}

          {/* 显示私有Agent（仅登录后可见） */}
          {isAuthenticated && allAgents.some((a) => a.isPrivate) && (
            <ModelSelectorGroup heading="私有Agent">
              {allAgents
                .filter((a) => a.isPrivate)
                .map((agent) => (
                  <ModelSelectorItem
                    className="gap-2"
                    key={agent.id}
                    onSelect={() => onChange?.(agent.id)}
                    value={agent.id}
                  >
                    <BotIcon className="size-4 shrink-0 text-muted-foreground" />
                    <ModelSelectorName>
                      <div className="flex items-center gap-1.5">
                        <span>{agent.name}</span>
                        <LockIcon className="size-3 opacity-50" />
                      </div>
                      {agent.description && (
                        <span className="block text-muted-foreground text-xs">
                          {agent.description}
                        </span>
                      )}
                    </ModelSelectorName>
                    {value === agent.id && (
                      <CheckIcon className="size-4 shrink-0" />
                    )}
                  </ModelSelectorItem>
                ))}
            </ModelSelectorGroup>
          )}

          {/* 未登录时提示 */}
          {!isAuthenticated && !isLoading && allAgents.some((a) => a.isPrivate) && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              登录后可使用私有Agent
            </p>
          )}
        </ModelSelectorList>
      </ModelSelectorContent>
    </AgentSelectorDialog>
  );
}
