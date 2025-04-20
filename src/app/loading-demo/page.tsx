"use client"

import TextLoading from '@/components/TextLoading';
import ImageLoading from '@/components/ImageLoading';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-[#fdfbfe]">
      <TextLoading className="mb-12" />
      <ImageLoading src="https://wx4.sinaimg.cn/mw690/cfc09aeagy1hzeh08k3n4j236u36ub2f.jpg" />
    </main>
  );
}