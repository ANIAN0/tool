'use client';
import { useEffect, useRef } from 'react';
import { animate } from 'animejs';  // 使用命名导出

export default function Loading() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<any>(null); // 存储动画实例的引用

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 创建加载动画元素
    const dots = Array.from({ length: 5 }).map(() => {
      const dot = document.createElement('div');
      dot.className = 'loading-dot';
      container.appendChild(dot);
      return dot;
    });

    // 使用 animate 函数，与官方示例一致
    const animation = animate(dots, {
      translateY: [
        { to: 0, duration: 0 },
        { to: -20, ease: 'outExpo', duration: 500 },
        { to: 0, ease: 'inExpo', duration: 500 }
      ],
      scale: [
        { to: 1, duration: 0 },
        { to: 1.2, ease: 'outExpo', duration: 500 },
        { to: 1, ease: 'inExpo', duration: 500 }
      ],
      backgroundColor: [
        { to: '#264ace', duration: 0 },
        { to: '#3a6cff', ease: 'outExpo', duration: 500 },
        { to: '#264ace', ease: 'inExpo', duration: 500 }
      ],
      delay: (_, i) => i * 200,  // 与官方示例一致的函数式延迟
      ease: 'inOutCirc',
      loop: true,
      loopDelay: 1000
    });
    
    // 保存动画实例以便清理
    animationRef.current = animation;

    // 清理函数
    return () => {
      // 停止动画
      if (animationRef.current && typeof animationRef.current.pause === 'function') {
        animationRef.current.pause();
      }
      
      // 移除创建的DOM元素
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div 
        ref={containerRef} 
        className="flex space-x-3 items-center justify-center h-20"
      ></div>
      <style jsx>{`
        .loading-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: #264ace;
        }
      `}</style>
    </div>
  );
}