/**
 * Skill 预置提示词预览组件
 * 在 Agent 编辑页面展示选择 Skill 后将注入的预置提示词内容
 *
 * 规格 4.4 节：
 * - 选择 Skill 后实时展示预置提示词预览
 * - 让用户知道 Agent 对话时会自动注入什么内容
 */

"use client";

import { useMemo } from "react";
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
 * SkillPresetPreview 组件的 Props
 */
interface SkillPresetPreviewProps {
  skillIds: string[];  // 已选择的 Skill ID 列表
  availableSkills: SkillInfo[];  // 可用的 Skill 列表（从父组件传入）
  expanded?: boolean;  // 是否展开，默认 true
  onExpandedChange?: (expanded: boolean) => void;  // 展开状态变化回调
}

/**
 * 生成预置提示词内容
 * 复用规格 5.2 节的模板
 * @param skills - Skill 列表
 * @returns 预置提示词文本
 */
function generatePresetPrompt(skills: SkillInfo[]): string {
  // 无 Skill 时返回空字符串
  if (skills.length === 0) return "";

  // 生成 Skill 列表项
  const skillList = skills
    .map((s) => `- **${s.name}**: ${s.description}\n  - 文件路径: \`skills/${s.name}/SKILL.md\``)
    .join("\n");

  // 返回完整的预置提示词
  return `## 已配置的 Skills

以下 Skills 已配置到你的环境中，位于沙盒 \`skills/\` 目录下：

${skillList}

### 如何使用 Skills

1. **读取 Skill 正文**: 使用 \`readFile\` 工具读取 \`skills/{skillName}/SKILL.md\`
2. **读取 Skill 目录下的文件**: 使用 \`readFile\` 工具读取 \`skills/{skillName}/\` 下的其他文件
3. **执行 Skill 目录下的脚本**: 使用 \`bash\` 工具执行 \`skills/{skillName}/\` 下的脚本文件

在执行 Skill 相关操作前，建议先读取 Skill 正文了解其具体功能和用法。`;
}

/**
 * Skill 预置提示词预览组件
 * 当用户在 Agent 编辑页面选择 Skill 后，展示将注入的预置提示词内容
 */
export function SkillPresetPreview({
  skillIds,
  availableSkills,
  expanded = true,
  onExpandedChange,
}: SkillPresetPreviewProps) {
  // 根据已选择的 skillIds 过滤出对应的 Skill 详情
  const selectedSkills = useMemo(() => {
    return availableSkills.filter((s) => skillIds.includes(s.id));
  }, [skillIds, availableSkills]);

  // 生成预置提示词内容
  const presetPrompt = useMemo(() => {
    return generatePresetPrompt(selectedSkills);
  }, [selectedSkills]);

  // 无 Skill 选中时不显示
  if (selectedSkills.length === 0) {
    return null;
  }

  // 处理展开/折叠
  const handleToggle = () => {
    onExpandedChange?.(!expanded);
  };

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
              预置提示词预览
            </CardTitle>
            {/* 自动生成标签 */}
            <Badge variant="secondary" className="text-xs">
              自动生成
            </Badge>
            {/* Skill 数量 */}
            <span className="text-xs text-muted-foreground">
              ({selectedSkills.length} 个 Skill)
            </span>
          </div>
          {/* 展开/折叠按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
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
              {selectedSkills.map((skill) => (
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

            {/* 预置提示词预览内容 */}
            <div className="text-xs bg-background/50 rounded p-3 font-mono whitespace-pre-wrap border">
              {presetPrompt}
            </div>

            {/* 说明文字 */}
            <p className="text-xs text-muted-foreground">
              此内容将在对话时自动注入到系统提示词中
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}