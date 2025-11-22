'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ImagePlus, 
  Trash2, 
  Download, 
  ArrowUp, 
  ArrowDown, 
  Loader2,
  Images,
  FileImage,
  Info
} from 'lucide-react';

export default function Main() {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string>('');

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);
    
    // 生成预览
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviews(prev => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearAll = useCallback(() => {
    setImages([]);
    setPreviews([]);
    setResultImage('');
  }, []);

  const handleMergeImages = useCallback(async () => {
    if (images.length === 0) {
      alert('请先上传图片');
      return;
    }

    setLoading(true);
    setResultImage('');

    try {
      const formData = new FormData();
      images.forEach((image, index) => {
        formData.append(`image${index}`, image);
      });

      const response = await fetch('/api/tools/image-merger?op=merge', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('拼接失败');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setResultImage(url);
    } catch (error) {
      console.error('拼接失败:', error);
      alert('图片拼接失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [images]);

  const handleDownload = useCallback(() => {
    if (!resultImage) return;
    
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `merged-${Date.now()}.png`;
    link.click();
  }, [resultImage]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setImages(prev => {
      const newImages = [...prev];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      return newImages;
    });
    setPreviews(prev => {
      const newPreviews = [...prev];
      [newPreviews[index - 1], newPreviews[index]] = [newPreviews[index], newPreviews[index - 1]];
      return newPreviews;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    if (index === images.length - 1) return;
    setImages(prev => {
      const newImages = [...prev];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      return newImages;
    });
    setPreviews(prev => {
      const newPreviews = [...prev];
      [newPreviews[index], newPreviews[index + 1]] = [newPreviews[index + 1], newPreviews[index]];
      return newPreviews;
    });
  }, [images.length]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 max-w-7xl">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <Images className="w-8 h-8 text-primary" strokeWidth={2} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            图片拼接工具
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            将多张图片按 800px 宽度从上到下拼接为一张图片
          </p>
        </div>

        <Separator className="mb-12" />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：上传和预览区域 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="w-5 h-5 text-primary" strokeWidth={2} />
                上传图片
              </CardTitle>
              <CardDescription>
                支持 JPG、PNG、WebP 等格式，可一次选择多张图片
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileImage className="w-10 h-10 mb-3 text-muted-foreground" strokeWidth={1.5} />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">点击上传</span> 或拖拽文件
                    </p>
                    <p className="text-xs text-muted-foreground/60">支持多张图片同时上传</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {images.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {images.length} 张图片
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      清空
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto rounded-lg border p-2 bg-muted/20">
                    {previews.map((preview, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-card rounded-lg border hover:border-foreground/20 transition-colors"
                      >
                        <img
                          src={preview}
                          alt={`预览 ${index + 1}`}
                          className="w-14 h-14 object-cover rounded border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">
                            {images[index].name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(images[index].size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            title="上移"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === images.length - 1}
                            title="下移"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveImage(index)}
                            className="text-destructive hover:text-destructive"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleMergeImages}
                disabled={images.length === 0 || loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    拼接中...
                  </>
                ) : (
                  <>
                    <Images className="w-4 h-4" />
                    开始拼接 ({images.length} 张图片)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 右侧：结果显示区域 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="w-5 h-5 text-primary" strokeWidth={2} />
                拼接结果
              </CardTitle>
              <CardDescription>
                {resultImage ? '拼接完成，可以下载保存' : '等待上传图片并开始拼接'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 min-h-[500px] flex items-center justify-center p-4">
                {loading ? (
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" strokeWidth={2} />
                    <p className="text-sm font-medium text-foreground">正在拼接图片...</p>
                    <p className="text-xs text-muted-foreground mt-1">请稍候</p>
                  </div>
                ) : resultImage ? (
                  <div className="w-full space-y-4">
                    <img
                      src={resultImage}
                      alt="拼接结果"
                      className="w-full rounded-lg shadow-lg"
                    />
                    <Button
                      onClick={handleDownload}
                      className="w-full"
                      size="lg"
                      variant="default"
                    >
                      <Download className="w-4 h-4" />
                      下载图片
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <FileImage className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-muted-foreground mb-1">拼接结果将在这里显示</p>
                    <p className="text-xs text-muted-foreground/60">上传图片并点击"开始拼接"</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 使用说明 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" strokeWidth={2} />
              使用说明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>支持同时上传多张图片，按选择顺序从上到下拼接</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>使用 <ArrowUp className="w-3 h-3 inline" /> <ArrowDown className="w-3 h-3 inline" /> 按钮可以调整图片顺序</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>所有图片会被缩放至 800px 宽度，保持原始宽高比</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>拼接后的图片为 PNG 格式，支持透明背景</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>点击"下载图片"按钮即可保存拼接结果</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-24 pt-12 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              支持常见图片格式 · 快速高效拼接
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
