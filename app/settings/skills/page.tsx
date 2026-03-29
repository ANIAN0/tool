/**
 * Skill 管理页面
 * 提供文件上传、列表展示、编辑、删除功能
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, Trash2, Loader2 } from "lucide-react";
import { SkillCard } from "@/components/settings/skill-card";
import { SkillUploadDialog } from "@/components/settings/skill-upload-dialog";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch"; // 导入认证请求工具

// Skill 数据类型定义（与 API 返回格式一致）
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

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // 加载 Skill 列表（使用认证请求）
  const loadSkills = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch("/api/skills"); // 使用认证请求替代普通 fetch
      if (response.ok) {
        const data = await response.json();
        setSkills(data.skills || []);
      }
    } catch (error) {
      console.error("加载 Skill 列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  // 删除 Skill（使用认证请求）
  const handleDelete = async (skillId: string) => {
    if (!confirm("确定要删除这个 Skill 吗？")) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/skills/${skillId}`, {
        method: "DELETE",
      }); // 使用认证请求替代普通 fetch

      if (response.ok) {
        setSkills(skills.filter((s) => s.id !== skillId));
      } else {
        const data = await response.json();
        alert(data.error?.message || "删除失败");
      }
    } catch (error) {
      console.error("删除 Skill 失败:", error);
      alert("删除失败");
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Skill 管理</h1>
          <p className="text-muted-foreground">上传和管理 Skill 文件</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          上传 Skill
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : skills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无 Skill，点击上方按钮上传</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onDelete={() => handleDelete(skill.id)}
            />
          ))}
        </div>
      )}

      <SkillUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={() => {
          setUploadDialogOpen(false);
          loadSkills();
        }}
      />
    </div>
  );
}