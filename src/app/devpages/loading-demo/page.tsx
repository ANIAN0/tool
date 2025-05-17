"use client"

import TextLoading from '@/components/TextLoading';
import ImageLoading from '@/components/ImageLoading';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-[#fdfbfe]">
      <TextLoading className="mb-12" />
      <ImageLoading src="https://img.picgo.net/2025/04/20/2025-04-20T13_56_10.101Z-88914953eec432079905f.gif" />
    </main>
  );
}

