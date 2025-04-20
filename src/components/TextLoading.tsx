"use client";
import { useEffect } from 'react';
import { animate } from 'animejs';

interface TextLoadingProps {
  text?: string;
  className?: string;
}

export default function TextLoading({ 
  text = "HELLO WORLD",
  className = "" 
}: TextLoadingProps) {
  useEffect(() => {
    console.log('TextLoading mounted');
    const elements = document.querySelectorAll('.letter-animation > span');
    console.log('Found elements:', elements.length);
    
    const animation = animate(elements, {
      y: [
        { to: '-2.75rem', ease: 'outExpo', duration: 600 },
        { to: 0, ease: 'outBounce', duration: 800, delay: 100 }
      ],
      rotate: {
        from: '-1turn',
        delay: 0
      },
      delay: (_, i) => i * 50,
      ease: 'inOutCirc',
      loop: true,
      loopDelay: 1000
    });

    return () => {
      console.log('TextLoading unmounted');
      animation.pause();  // 清理现有动画
    };
  }, []);

  const letters = text.split('');

  return (
    <h2 className={`letter-animation inline-flex gap-0.5 text-center font-bold ${className}`}>
      {letters.map((letter, index) => (
        <span key={index}>{letter === ' ' ? '\u00A0' : letter}</span>
      ))}
    </h2>
  );
}