'use client';

import { useState, useCallback } from 'react';

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
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">🖼️ 图片拼接工具</h1>
      <p className="text-gray-600 mb-8">将多张图片按800px宽度从上到下拼接为一张图片</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：上传和预览区域 */}
        <div>
          <div className="mb-4">
            <label className="block mb-2 font-medium">上传图片</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
            <p className="mt-2 text-sm text-gray-500">
              支持 JPG、PNG、WebP 等格式，可一次选择多张图片
            </p>
          </div>

          {images.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">已选择 {images.length} 张图片</h3>
                <button
                  onClick={handleClearAll}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  清空所有
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-2">
                {previews.map((preview, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded border"
                  >
                    <img
                      src={preview}
                      alt={`预览 ${index + 1}`}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {images[index].name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(images[index].size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-1 text-gray-600 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                        title="上移"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === images.length - 1}
                        className="p-1 text-gray-600 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                        title="下移"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="p-1 text-red-600 hover:text-red-700"
                        title="删除"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleMergeImages}
            disabled={images.length === 0 || loading}
            className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? '拼接中...' : `开始拼接 (${images.length} 张图片)`}
          </button>
        </div>

        {/* 右侧：结果显示区域 */}
        <div>
          <h3 className="font-medium mb-2">拼接结果</h3>
          <div className="border rounded-lg p-4 bg-gray-50 min-h-[400px] flex items-center justify-center">
            {loading ? (
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
                <p className="mt-4 text-gray-600">正在拼接图片...</p>
              </div>
            ) : resultImage ? (
              <div className="w-full">
                <img
                  src={resultImage}
                  alt="拼接结果"
                  className="w-full rounded shadow-lg"
                />
                <button
                  onClick={handleDownload}
                  className="w-full mt-4 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                >
                  下载图片
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <p>拼接结果将在这里显示</p>
                <p className="text-sm mt-2">上传图片并点击"开始拼接"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium mb-2">📖 使用说明</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• 支持同时上传多张图片，按选择顺序从上到下拼接</li>
          <li>• 使用 ↑ ↓ 按钮可以调整图片顺序</li>
          <li>• 所有图片会被缩放至 800px 宽度，保持原始宽高比</li>
          <li>• 拼接后的图片为 PNG 格式，支持透明背景</li>
          <li>• 点击"下载图片"按钮即可保存拼接结果</li>
        </ul>
      </div>
    </div>
  );
}
