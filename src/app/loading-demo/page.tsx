"use client";
import { useEffect } from 'react';
import { animate } from 'animejs';
import Loading from './components/Loading';

export default function Home() {
  useEffect(() => {
    // 确保在客户端渲染时执行动画
    animate('.letter-animation span', {
      y: [
        { to: '-2.75rem', ease: 'outExpo', duration: 600 },
        { to: 0, ease: 'outBounce', duration: 800, delay: 100 }
      ],
      rotate: {
        from: '-1turn',
        delay: 0
      },
      delay: (_, i) => i * 50, // 每个字母的延迟
      ease: 'inOutCirc',
      loop: true,
      loopDelay: 1000
    });
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-100">
      <h2 className="letter-animation text-4xl font-bold mb-12 grid grid-cols-11 gap-2 text-center">
        <span>H</span>
        <span>E</span>
        <span>L</span>
        <span>L</span>
        <span>O</span>
        <span>&nbsp;</span>
        <span>W</span>
        <span>O</span>
        <span>R</span>
        <span>L</span>
        <span>D</span>
      </h2>
      
      <div className="mt-12">
        <Loading />
      </div>
    </main>
  );
}