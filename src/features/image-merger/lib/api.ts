import { NextRequest } from 'next/server';
import sharp from 'sharp';

// 图片拼接API
export async function merge(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFiles: File[] = [];
    
    // 提取所有图片文件
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image') && value instanceof File) {
        imageFiles.push(value);
      }
    }

    if (imageFiles.length === 0) {
      return Response.json({ error: '没有上传图片' }, { status: 400 });
    }

    // 将图片转换为 Buffer
    const imageBuffers = await Promise.all(
      imageFiles.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return Buffer.from(arrayBuffer);
      })
    );

    // 使用 sharp 进行图片拼接
    const mergedImage = await mergeImagesOnServer(imageBuffers);
    
    return new Response(new Uint8Array(mergedImage), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="merged-${Date.now()}.png"`,
      },
    });
  } catch (error) {
    console.error('图片拼接失败:', error);
    return Response.json({ error: '图片拼接失败' }, { status: 500 });
  }
}

// 服务器端图片拼接逻辑
async function mergeImagesOnServer(imageBuffers: Buffer[]): Promise<Buffer> {
  const TARGET_WIDTH = 800;

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
          .png()
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

  return canvas.composite(compositeImages).png().toBuffer();
}
