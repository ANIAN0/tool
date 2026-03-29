/**
 * Skill 选择器组件
 * 用于 Agent 表单中选择关联的 Skill
 */

"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText } from "lucide-react";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch"; // 导入认证请求工具

interface Skill {
  id: string;
  name: string;
  description: string;
  agentCount: number;
}

interface SkillSelectorProps {
  selectedSkillIds: string[];
  onChange: (skillIds: string[]) => void;
  onSkillsLoaded?: (skills: Skill[]) => void;  // 新增：Skill 列表加载完成回调
}

export function SkillSelector({ selectedSkillIds, onChange, onSkillsLoaded }: SkillSelectorProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载用户的 Skill 列表
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const response = await authenticatedFetch("/api/skills"); // 使用认证请求替代普通 fetch
        if (response.ok) {
          const data = await response.json();
          const loadedSkills = data.skills || [];
          setSkills(loadedSkills);
          // 新增：通知父组件 Skill 列表已加载
          onSkillsLoaded?.(loadedSkills);
        }
      } catch (error) {
        console.error("加载 Skill 列表失败:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSkills();
  }, [onSkillsLoaded]);

  // 切换 Skill 选择
  const handleToggle = (skillId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedSkillIds, skillId]);
    } else {
      onChange(selectedSkillIds.filter((id) => id !== skillId));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载 Skill 列表中...
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        暂无可用 Skill，
        <a href="/settings/skills" className="text-primary hover:underline">
          前往上传
        </a>
      </div>
    );
  }

  return (
    <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto">
      <div className="space-y-3">
        {skills.map((skill) => (
          <div key={skill.id} className="flex items-start space-x-2">
            <Checkbox
              id={`skill-${skill.id}`}
              checked={selectedSkillIds.includes(skill.id)}
              onCheckedChange={(checked) => handleToggle(skill.id, checked as boolean)}
            />
            <div className="grid gap-1 leading-none">
              <label
                htmlFor={`skill-${skill.id}`}
                className="text-sm font-medium leading-none cursor-pointer"
              >
                <FileText className="h-3 w-3 inline-block mr-1" />
                {skill.name}
              </label>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {skill.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}