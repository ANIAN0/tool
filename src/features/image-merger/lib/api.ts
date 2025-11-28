import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { saveFileToDatabase } from '@/features/file-share/lib/database';

// 图片拼接API
export async function merge(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let imageBuffers: Buffer[] = [];
    let returnType: 'file' | 'url' = 'file'; // 默认返回文件

    // 方式1: FormData 上传（支持多图片）
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFiles: File[] = [];
      const imageUrlParams: string[] = [];
      
      // 提取所有图片文件和URL
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('image') && value instanceof File) {
          imageFiles.push(value);
        } else if (key.startsWith('imageUrl') && typeof value === 'string') {
          imageUrlParams.push(value);
        } else if (key === 'returnType' && typeof value === 'string') {
          // 获取返回类型参数
          returnType = value as 'file' | 'url';
        }
      }

      if (imageFiles.length === 0 && imageUrlParams.length === 0) {
        return Response.json(
          { 
            error: '没有上传图片',
            message: '请使用 FormData 格式上传图片，参数名为 image0, image1... 或 imageUrl0, imageUrl1...'
          }, 
          { status: 400 }
        );
      }

      // 限制图片数量
      const MAX_IMAGES = 20;
      if (imageFiles.length + imageUrlParams.length > MAX_IMAGES) {
        return Response.json(
          { 
            error: '图片数量超出限制',
            message: `最多支持上传 ${MAX_IMAGES} 张图片，当前上传了 ${imageFiles.length + imageUrlParams.length} 张`
          }, 
          { status: 400 }
        );
      }

      // 处理本地文件
      const fileBuffers = await Promise.all(
        imageFiles.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          return Buffer.from(arrayBuffer);
        })
      );

      // 处理URL图片
      const urlBuffers = await Promise.all(
        imageUrlParams.map(async (url) => {
          try {
            // 验证URL格式
            new URL(url);
            
            // 添加User-Agent头部以避免某些服务器拒绝请求
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ImageMerger/1.0; +https://your-domain.com)'
              }
            });
            
            if (!response.ok) {
              // 特别处理404错误，提供更详细的错误信息
              if (response.status === 404) {
                throw new Error(`文件不存在或已过期 (HTTP 404: Not Found)`);
              }
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
              throw new Error(`URL不是有效的图片文件 (Content-Type: ${contentType || 'unknown'})`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            console.log(`成功下载图片: ${url}, 大小: ${arrayBuffer.byteLength} bytes, 类型: ${contentType}`);
            return Buffer.from(arrayBuffer);
          } catch (error) {
            console.error(`下载图片失败 (${url}):`, error);
            throw new Error(`下载图片失败 (${url}): ${error instanceof Error ? error.message : '未知错误'}`);
          }
        })
      );

      imageBuffers = [...fileBuffers, ...urlBuffers];
    }
    // 方式2: 直接上传二进制数据（单图片）
    else if (contentType.includes('image/') || contentType.includes('application/octet-stream')) {
      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        return Response.json(
          { 
            error: '没有上传图片',
            message: '请求体为空，请上传图片数据'
          }, 
          { status: 400 }
        );
      }
      imageBuffers = [Buffer.from(arrayBuffer)];
    }
    // 方式3: JSON 格式上传 Base64 编码的图片或URL
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const images = body.images || [];
      const imageUrls = body.imageUrls || [];
      returnType = body.returnType || 'file'; // 获取返回类型参数
      
      if ((!Array.isArray(images) || images.length === 0) && (!Array.isArray(imageUrls) || imageUrls.length === 0)) {
        return Response.json(
          { 
            error: '没有上传图片',
            message: '请在 JSON 中提供 images 数组（base64编码）或 imageUrls 数组（图片URL）'
          }, 
          { status: 400 }
        );
      }

      const MAX_IMAGES = 20;
      if (images.length + imageUrls.length > MAX_IMAGES) {
        return Response.json(
          { 
            error: '图片数量超出限制',
            message: `最多支持上传 ${MAX_IMAGES} 张图片，当前上传了 ${images.length + imageUrls.length} 张`
          }, 
          { status: 400 }
        );
      }

      // 处理 base64 图片
      const base64Buffers = images.map((base64: string) => {
        // 移除 data:image/xxx;base64, 前缀（如果存在）
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        return Buffer.from(base64Data, 'base64');
      });

      // 处理 URL 图片
      const urlBuffers = await Promise.all(
        imageUrls.map(async (url: string) => {
          try {
            // 验证URL格式
            new URL(url);
            
            // 添加User-Agent头部以避免某些服务器拒绝请求
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ImageMerger/1.0; +https://your-domain.com)'
              }
            });
            
            if (!response.ok) {
              // 特别处理404错误，提供更详细的错误信息
              if (response.status === 404) {
                throw new Error(`文件不存在或已过期 (HTTP 404: Not Found)`);
              }
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
              throw new Error(`URL不是有效的图片文件 (Content-Type: ${contentType || 'unknown'})`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            console.log(`成功下载图片: ${url}, 大小: ${arrayBuffer.byteLength} bytes, 类型: ${contentType}`);
            return Buffer.from(arrayBuffer);
          } catch (error) {
            console.error(`下载图片失败 (${url}):`, error);
            throw new Error(`下载图片失败 (${url}): ${error instanceof Error ? error.message : '未知错误'}`);
          }
        })
      );

      imageBuffers = [...base64Buffers, ...urlBuffers];
    }
    else {
      return Response.json(
        { 
          error: '不支持的内容类型',
          message: '支持的上传方式：1) FormData (multipart/form-data) 2) 二进制数据 (image/*) 3) JSON (application/json with base64)'
        }, 
        { status: 400 }
      );
    }

    // 使用 sharp 进行图片拼接
    const startTime = Date.now();
    const mergedImage = await mergeImagesOnServer(imageBuffers);
    const processingTime = Date.now() - startTime;
    
    // 如果需要返回URL，则将图片保存到文件分享目录并返回URL
    if (returnType === 'url') {
      // 创建FormData对象并添加拼接后的图片
      const formData = new FormData();
      const uint8Array = new Uint8Array(mergedImage);
      const blob = new Blob([uint8Array], { type: 'image/jpeg' }); // 更改为JPEG
      formData.append('file0', blob, 'merged-image.jpg'); // 更改为.jpg扩展名

      try {
        // 直接调用文件上传工具的接口
        // 在服务器环境中需要构造完整的URL
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NODE_ENV === 'production'
          ? 'https://tool-xi-dun.vercel.app'  // 使用实际的生产环境域名
          : 'http://localhost:3000';
          
        const uploadUrl = `${baseUrl}/api/tools/file-share?op=upload`;
        console.log(`调用文件上传接口: ${uploadUrl}`);
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(`文件上传失败: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log('文件上传成功:', uploadResult);

        if (!uploadResult.files || uploadResult.files.length === 0) {
          throw new Error('文件上传接口未返回有效的文件信息');
        }

        const uploadedFile = uploadResult.files[0];
        
        return Response.json({
          message: '图片拼接成功',
          url: uploadedFile.url,
          fileId: uploadedFile.id
        }, {
          headers: {
            'X-Image-Count': imageBuffers.length.toString(),
            'X-Processing-Time': `${processingTime}ms`,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'X-Image-Count, X-Processing-Time',
          },
        });
      } catch (uploadError) {
        console.error('调用文件上传接口失败:', uploadError);
        throw new Error(`调用文件上传接口失败: ${uploadError instanceof Error ? uploadError.message : '未知错误'}`);
      }
    } else {
      // 返回文件格式
      return new Response(new Uint8Array(mergedImage), {
        headers: {
          'Content-Type': 'image/jpeg', // 更改为JPEG
          'Content-Disposition': `attachment; filename="merged-${Date.now()}.jpg"`, // 更改为.jpg扩展名
          'X-Image-Count': imageBuffers.length.toString(),
          'X-Processing-Time': `${processingTime}ms`,
          'Access-Control-Allow-Origin': '*', // 允许跨域调用
          'Access-Control-Expose-Headers': 'X-Image-Count, X-Processing-Time',
        },
      });
    }
  } catch (error) {
    console.error('图片拼接失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return Response.json(
      { 
        error: '图片拼接失败',
        message: errorMessage,
        timestamp: new Date().toISOString()
      }, 
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function options() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// 服务器端图片拼接逻辑
async function mergeImagesOnServer(imageBuffers: Buffer[], targetWidth = 600): Promise<Buffer> {
  const TARGET_WIDTH = targetWidth;

  // 处理所有图片，缩放到目标宽度
  const processedImages = await Promise.all(
    imageBuffers.map(async (buffer) => {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('无法获取图片尺寸');
      }

      const scale = TARGET_WIDTH / metadata.width;
      const newHeight = Math.round(metadata.height * scale);

      return {
        buffer: await image
          .resize(TARGET_WIDTH, newHeight)
          .jpeg({ quality: 70 }) // 降低JPEG质量以减小文件大小
          .toBuffer(),
        height: newHeight,
      };
    })
  );

  // 计算总高度
  const totalHeight = processedImages.reduce((sum, img) => sum + img.height, 0);

  // 创建空白画布
  const canvas = sharp({
    create: {
      width: TARGET_WIDTH,
      height: totalHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  });

  // 组合所有图片
  const compositeImages = [];
  let currentY = 0;
  
  for (const { buffer, height } of processedImages) {
    compositeImages.push({
      input: buffer,
      top: currentY,
      left: 0,
    });
    currentY += height;
  }

  // 使用JPEG格式并进一步降低质量以减小文件大小
  return canvas.composite(compositeImages).jpeg({ quality: 70 }).toBuffer();
}
