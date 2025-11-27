'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  Download, 
  Eye, 
  Trash2, 
  FileImage, 
  FileVideo, 
  FileAudio,
  FileText,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Info,
  Copy
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type UploadedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  path: string;
  expiresAt: string;
  uploadedAt: string;
};

type ModalType = 'success' | 'error' | 'info' | 'confirm';
type ModalState = {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  onConfirm?: () => void;
};

export default function Main() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalState>({ isOpen: false, type: 'info', title: '', message: '' });
  const router = useRouter();

  // 检查是否已登录
  useEffect(() => {
    const token = localStorage.getItem('file-share-token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  // 获取文件列表
  const fetchFiles = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/tools/file-share?op=list');
      if (response.ok) {
        const result = await response.json();
        setFiles(result.files);
      } else {
        const errorResult = await response.json().catch(() => ({}));
        showModal('error', '获取文件列表失败', errorResult.error || '未知错误');
      }
    } catch (error: any) {
      showModal('error', '获取文件列表异常', error.message || '网络错误');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // 页面加载时获取文件列表
  useEffect(() => {
    if (isLoggedIn) {
      fetchFiles();
    }
  }, [isLoggedIn, fetchFiles]);

  // 显示模态框
  const showModal = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setModal({ isOpen: true, type, title, message, onConfirm });
  };

  // 关闭模态框
  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  // 确认操作
  const handleConfirm = () => {
    if (modal.onConfirm) {
      modal.onConfirm();
    }
    closeModal();
  };

  // 登录验证
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // 使用相对路径避免混合内容问题
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.authenticated) {
          localStorage.setItem('file-share-token', 'authenticated');
          setIsLoggedIn(true);
          showModal('success', '登录成功', '欢迎使用文件分享工具');
        } else {
          showModal('error', '认证失败', result.message || '用户名或密码错误');
        }
      } else {
        const errorResult = await response.json().catch(() => ({}));
        showModal('error', '认证失败', errorResult.message || '网络错误');
      }
    } catch (error: any) {
      showModal('error', '认证失败', error.message || '请求异常');
    } finally {
      setIsLoading(false);
    }
  }, [password]);

  // 登出
  const handleLogout = useCallback(() => {
    localStorage.removeItem('file-share-token');
    setIsLoggedIn(false);
    setFiles([]);
    setUsername('');
    setPassword('');
    showModal('info', '登出成功', '您已安全退出登录');
  }, []);

  // 上传文件
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      selectedFiles.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });
      
      const response = await fetch('/api/tools/file-share?op=upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        setFiles(prev => [...prev, ...result.files]);
        showModal('success', '上传成功', `成功上传 ${result.files.length} 个文件`);
      } else {
        const errorResult = await response.json().catch(() => ({}));
        showModal('error', '上传失败', errorResult.error || '未知错误');
      }
    } catch (error: any) {
      showModal('error', '上传异常', error.message || '网络错误');
    } finally {
      setUploading(false);
      // 清空input值，允许重复选择相同文件
      if (e.target) {
        e.target.value = '';
      }
    }
  }, []);

  // 删除文件
  const handleDeleteFile = useCallback(async (fileId: string, index: number) => {
    showModal('confirm', '确认删除', '确定要删除这个文件吗？此操作不可撤销。', async () => {
      try {
        const response = await fetch(`/api/tools/file-share?op=deleteFile&fileId=${fileId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          setFiles(prev => prev.filter((_, i) => i !== index));
          showModal('success', '删除成功', '文件已成功删除');
        } else {
          const errorResult = await response.json().catch(() => ({}));
          showModal('error', '删除失败', errorResult.error || '未知错误');
        }
      } catch (error: any) {
        showModal('error', '删除异常', error.message || '网络错误');
      }
    });
  }, []);

  // 下载文件
  const handleDownloadFile = useCallback((url: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      showModal('error', '下载异常', error.message || '操作失败');
    }
  }, []);

  // 预览文件
  const handlePreviewFile = useCallback((url: string) => {
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set('inline', '1');
      window.open(u.toString(), '_blank');
    } catch (error: any) {
      showModal('error', '预览异常', error.message || '操作失败');
    }
  }, []);

  // 复制文件URL到剪贴板
  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      // 创建完整的URL
      const fullUrl = new URL(url, window.location.origin).toString();
      
      // 使用Clipboard API复制URL
      await navigator.clipboard.writeText(fullUrl);
      showModal('success', '复制成功', '文件URL已复制到剪贴板');
    } catch (error: any) {
      // 降级方案：使用传统的textarea方法
      try {
        const textarea = document.createElement('textarea');
        const fullUrl = new URL(url, window.location.origin).toString();
        textarea.value = fullUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showModal('success', '复制成功', '文件URL已复制到剪贴板');
      } catch (fallbackError) {
        showModal('error', '复制失败', '无法复制URL到剪贴板');
      }
    }
  }, []);

  // 获取文件图标
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <FileImage className="w-5 h-5 text-blue-500" />;
    if (fileType.startsWith('video/')) return <FileVideo className="w-5 h-5 text-green-500" />;
    if (fileType.startsWith('audio/')) return <FileAudio className="w-5 h-5 text-purple-500" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化剩余时间
  const formatTimeLeft = (expiresAt: string) => {
    const expireDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expireDate.getTime() - now.getTime();
    
    if (diffMs <= 0) return '已过期';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}小时${diffMinutes}分钟`;
    }
    return `${diffMinutes}分钟`;
  };

  // 渲染模态框图标
  const renderModalIcon = () => {
    switch (modal.type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'confirm':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      default:
        return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  // 未登录状态
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              用户登录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">密码</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="请输入密码"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    验证中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </form>
            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>请输入密码进行身份验证</p>
            </div>
          </CardContent>
        </Card>

        {/* 自定义模态框 */}
        {modal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {renderModalIcon()}
                  {modal.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{modal.message}</p>
                <div className="flex gap-2 mt-6">
                  {modal.type === 'confirm' ? (
                    <>
                      <Button variant="outline" onClick={closeModal} className="flex-1">
                        取消
                      </Button>
                      <Button onClick={handleConfirm} className="flex-1">
                        确定
                      </Button>
                    </>
                  ) : (
                    <Button onClick={closeModal} className="w-full">
                      确定
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // 已登录状态
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">文件分享工具</h1>
            <p className="text-muted-foreground mt-2">上传文件并生成临时链接，24小时后自动删除</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchFiles} disabled={refreshing}>
              {refreshing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  刷新中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              退出登录
            </Button>
          </div>
        </div>

        {/* 上传区域 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              上传文件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-foreground/20 transition-colors">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload" 
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="p-3 bg-primary/10 rounded-full">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {uploading ? '文件上传中...' : '点击选择文件或拖拽文件到此处'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    支持图片、视频、音频文件，单个文件最大100MB
                  </p>
                </div>
                {uploading && (
                  <div className="mt-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                )}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 文件列表 */}
        {files.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                已上传文件 ({files.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.map((file, index) => (
                  <Card key={file.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {getFileIcon(file.type)}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate text-foreground">
                            {file.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatFileSize(file.size)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            剩余时间: {formatTimeLeft(file.expiresAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handlePreviewFile(file.url)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          预览
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleDownloadFile(file.url, file.name)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          下载
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleCopyUrl(file.url)}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          复制
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleDeleteFile(file.id, index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground">暂无上传文件</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                请先上传文件以生成临时链接
              </p>
            </CardContent>
          </Card>
        )}

        {/* 说明信息 */}
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">使用说明：</p>
              <ul className="space-y-1 text-xs">
                <li>• 文件上传后将生成临时链接，24小时后自动删除</li>
                <li>• 支持图片、视频、音频等多种格式文件，单个文件最大100MB</li>
                <li>• 可随时预览、下载或删除已上传的文件</li>
                <li>• 请妥善保管您的登录凭证</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 自定义模态框 */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {renderModalIcon()}
                {modal.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{modal.message}</p>
              <div className="flex gap-2 mt-6">
                {modal.type === 'confirm' ? (
                  <>
                    <Button variant="outline" onClick={closeModal} className="flex-1">
                      取消
                    </Button>
                    <Button onClick={handleConfirm} className="flex-1">
                      确定
                    </Button>
                  </>
                ) : (
                  <Button onClick={closeModal} className="w-full">
                    确定
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}