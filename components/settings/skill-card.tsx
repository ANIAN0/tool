/**
 * Skill 卡片组件
 * 展示 Skill 信息和操作按钮
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Eye, Users, FolderOpen } from "lucide-react";
import { SkillDetailDialog } from "./skill-detail-dialog";

// Skill 数据类型定义
interface Skill {
  id: string;
  name: string;
  description: string;
  metadata: string | null;
  agentCount: number;
  fileCount: number;      // 文件数量
  totalSize: number;      // 总大小（字节）
  createdAt: number;
  updatedAt: number;
}

interface SkillCardProps {
  skill: Skill;
  onDelete: () => void;
}

/**
 * 格式化文件大小
 * @param bytes 文件大小（字节）
 * @returns 格式化后的字符串
 */
function formatFileSize(bytes: number): string {
  // 小于 1KB 显示字节
  if (bytes < 1024) return `${bytes} B`;
  // 小于 1MB 显示 KB
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  // 大于 1MB 显示 MB
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SkillCard({ skill, onDelete }: SkillCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  // 格式化日期显示
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{skill.name}</CardTitle>
          <CardDescription className="line-clamp-2">{skill.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 统计信息区域：Agent数量、文件数量、文件大小、更新时间 */}
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
            {/* 左侧：Agent 数量 */}
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{skill.agentCount} 个 Agent</span>
            </div>
            {/* 中间：文件数量和大小 */}
            <div className="flex items-center gap-1">
              <FolderOpen className="h-4 w-4" />
              <span>{skill.fileCount} 个文件</span>
              <span className="mx-1">·</span>
              <span>{formatFileSize(skill.totalSize)}</span>
            </div>
            {/* 右侧：更新时间 */}
            <span>{formatDate(skill.updatedAt)}</span>
          </div>
          {/* 操作按钮区域 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setDetailOpen(true)}
            >
              <Eye className="h-4 w-4 mr-1" />
              查看
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={skill.agentCount > 0}
              title={skill.agentCount > 0 ? "请先移除关联的 Agent" : "删除"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Skill 详情弹窗 */}
      <SkillDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        skillId={skill.id}
      />
    </>
  );
}