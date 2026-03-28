"use client";

/**
 * 数据库驱动的Agent选择器组件
 * 从数据库加载用户的Agent和公开Agent列表
 */

import { useEffect, useState } from "react";
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
import { BotIcon, CheckIcon, ChevronDownIcon, GlobeIcon } from "lucide-react";
import { getAnonId } from "@/lib/anon-id";
import { useAuth } from "@/lib/hooks/use-auth";

/**
 * Agent简要信息类型
 */
interface AgentBrief {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  creator?: {
    id: string;
    username: string | null;
  };
}

/**
 * DbAgentSelectorProps
 */
interface DbAgentSelectorProps {
  // 当前选中的Agent ID
  value?: string;
  // Agent变更回调
  onChange?: (agentId: string) => void;
  // 是否禁用
  disabled?: boolean;
}

/**
 * 数据库驱动的Agent选择器组件
 */
export function DbAgentSelector({
  value,
  onChange,
  disabled = false,
}: DbAgentSelectorProps) {
  const { isAuthenticated } = useAuth();

  // 我的Agent列表
  const [myAgents, setMyAgents] = useState<AgentBrief[]>([]);
  // 公开Agent列表
  const [publicAgents, setPublicAgents] = useState<AgentBrief[]>([]);
  // 加载状态
  const [isLoading, setIsLoading] = useState(true);

  // 加载Agent列表
  useEffect(() => {
    const fetchAgents = async () => {
      const anonId = getAnonId();
      if (!anonId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 调用 /api/agents 获取我的Agent和公开Agent
        const res = await fetch("/api/agents", {
          headers: { "X-User-Id": anonId },
        });

        if (res.ok) {
          const data = await res.json();
          // 转换为AgentBrief格式
          // 我的Agent列表
          const myAgentsList = (data.data?.myAgents || []).map((a: { id: string; name: string; description: string | null; is_public: boolean }) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            isPublic: a.is_public,
          }));
          setMyAgents(myAgentsList);

          // 公开Agent列表（含创建者信息）
          const publicAgentsList = (data.data?.publicAgents || []).map((a: { id: string; name: string; description: string | null; is_public: boolean; creator?: { id: string; username: string | null } }) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            isPublic: a.is_public,
            creator: a.creator,
          }));
          setPublicAgents(publicAgentsList);
        }
      } catch (error) {
        console.error("获取Agent列表失败:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, [isAuthenticated]);

  // 获取当前选中的Agent
  const allAgents = [...myAgents, ...publicAgents];
  const selectedAgent = allAgents.find((a) => a.id === value);

  return (
    <AgentSelectorDialog>
      <ModelSelectorTrigger asChild>
        <Button
          className="gap-1.5 text-sm"
          disabled={disabled || isLoading}
          size="sm"
          variant="outline"
        >
          {selectedAgent ? (
            <>
              <BotIcon className="size-4" />
              <span>{selectedAgent.name}</span>
              {selectedAgent.isPublic && (
                <GlobeIcon className="size-3.5 opacity-50" />
              )}
            </>
          ) : (
            <span>选择Agent</span>
          )}
          <ChevronDownIcon className="size-3.5 opacity-50" />
        </Button>
      </ModelSelectorTrigger>

      <ModelSelectorContent className="sm:max-w-[320px]" title="选择Agent">
        <ModelSelectorInput placeholder="搜索Agent..." />

        <ModelSelectorList>
          <ModelSelectorEmpty>未找到匹配的Agent</ModelSelectorEmpty>

          {/* 我的Agent（仅登录后显示） */}
          {isAuthenticated && myAgents.length > 0 && (
            <ModelSelectorGroup heading="我的Agent">
              {myAgents.map((agent) => (
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

          {/* 公开Agent */}
          {publicAgents.length > 0 && (
            <ModelSelectorGroup heading="公开Agent">
              {publicAgents.map((agent) => (
                <ModelSelectorItem
                  className="gap-2"
                  key={agent.id}
                  onSelect={() => onChange?.(agent.id)}
                  value={agent.id}
                >
                  <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
                  <ModelSelectorName>
                    <div className="flex items-center gap-1.5">
                      <span>{agent.name}</span>
                    </div>
                    {agent.description && (
                      <span className="block text-muted-foreground text-xs">
                        {agent.description}
                      </span>
                    )}
                    {agent.creator && (
                      <span className="block text-muted-foreground text-xs">
                        by {agent.creator.username || "匿名用户"}
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

          {/* 无Agent提示 */}
          {!isLoading && myAgents.length === 0 && publicAgents.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              暂无可用Agent
            </p>
          )}
        </ModelSelectorList>
      </ModelSelectorContent>
    </AgentSelectorDialog>
  );
}