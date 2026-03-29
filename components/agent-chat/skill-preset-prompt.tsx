"use client";

/**
 * Skill 预置提示词展示组件
 * 在 Agent Chat 页面展示当前 Agent 配置的 Skill 信息
 *
 * 规格 5.5 节：
 * - 预置提示词在系统提示词下方展示
 * - 灰色背景区块，标记为「Skill 配置（自动生成）」
 * - 用户不可编辑，仅可查看
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

/**
 * Skill 信息接口
 */
interface SkillInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * SkillPresetPrompt 组件的 Props
 */
interface SkillPresetPromptProps {
  agentId: string;
}

/**
 * Skill 预置提示词展示组件
 * 当用户选择一个配置了 Skill 的 Agent 时，显示该 Agent 配置的 Skill 信息
 */
export function SkillPresetPrompt({ agentId }: SkillPresetPromptProps) {
  // Skill 列表状态
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(true);
  // 展开状态
  const [expanded, setExpanded] = useState(true);

  // 加载 Agent 关联的 Skill 信息
  useEffect(() => {
    const loadSkills = async () => {
      // 无 Agent ID 时清空并结束加载
      if (!agentId) {
        setSkills([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // 获取 Agent 详情，包含关联的 Skills
        const response = await fetch(`/api/agents/${agentId}`);
        if (response.ok) {
          const data = await response.json();
          // 设置 Skill 列表（从 Agent 数据中获取）
          setSkills(data.data?.skills || []);
        }
      } catch (error) {
        console.error("加载 Skill 信息失败:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSkills();
  }, [agentId]);

  // 无 Skill 或加载中时不显示组件
  if (loading || skills.length === 0) {
    return null;
  }

  return (
    <Card className="bg-muted/50 border-dashed">
      {/* 卡片头部 */}
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Skill 图标 */}
            <Sparkles className="h-4 w-4 text-blue-500" />
            {/* 标题 */}
            <CardTitle className="text-sm font-medium">
              Skill 配置
            </CardTitle>
            {/* 自动生成标签 */}
            <Badge variant="secondary" className="text-xs">
              自动生成
            </Badge>
          </div>
          {/* 展开/折叠按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {/* 展开内容 */}
      {expanded && (
        <CardContent className="py-3 px-4 pt-0">
          <div className="space-y-3">
            {/* Skill 列表 */}
            <div className="space-y-2">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-start gap-2 text-sm"
                >
                  {/* Skill 文件图标 */}
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    {/* Skill 名称 */}
                    <span className="font-medium">{skill.name}</span>
                    {/* Skill 描述 */}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {skill.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* 使用说明 */}
            <div className="text-xs text-muted-foreground bg-background/50 rounded p-2">
              <p className="font-medium mb-1">如何使用 Skills：</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  使用 <code className="text-blue-600">readFile</code> 工具读取{" "}
                  <code className="text-blue-600">skills/{'{skillName}'}/SKILL.md</code>
                </li>
                <li>
                  使用 <code className="text-blue-600">bash</code> 工具执行脚本文件
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}