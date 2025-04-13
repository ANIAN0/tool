import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone"
import { User } from "@supabase/supabase-js"

interface UploadSectionProps {
  user: User | null
  uploadProps: any
}

export default function UploadSection({ user, uploadProps }: UploadSectionProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Supabase 文件上传</CardTitle>
        </CardHeader>
        <CardContent>
          <Dropzone {...uploadProps} className="min-h-[200px] flex flex-col justify-center">
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>
          
          <div className="mt-4 text-sm text-muted-foreground">
            <p>支持的文件类型: 图片、PDF、语音文件(.mp3, .wav等)和Markdown文件(.md)</p>
            <p>最大文件大小: 5MB</p>
            <p>最大文件数量: 3个</p>
            {user && <p>上传用户: {user?.email}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={uploadProps.onUpload} 
            disabled={uploadProps.loading || uploadProps.files.length === 0 || !user}
            className="ml-auto"
          >
            {uploadProps.loading ? "上传中..." : "上传文件"}
          </Button>
        </CardFooter>
      </Card>
      
      <div className="mt-6 p-6 border rounded-lg bg-muted/20">
        <h2 className="text-xl font-semibold mb-4">实现说明</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>使用 <code>useSupabaseUpload</code> 钩子处理文件上传逻辑</li>
          <li>配置上传参数：存储桶、路径、文件大小限制、最大文件数量、允许的文件类型</li>
          <li>使用 <code>Dropzone</code> 组件提供拖放界面</li>
          <li>在路径中包含用户ID，确保文件存储在用户专属目录</li>
          <li>添加上传状态和禁用逻辑，未登录用户不能上传文件</li>
        </ol>
      </div>
    </>
  )
}