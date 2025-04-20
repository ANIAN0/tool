"use client"

interface ImageLoadingProps {
  src: string;
  className?: string;
}

export default function ImageLoading({ src, className = '' }: ImageLoadingProps) {
  return (
    <div className="p-4">
      <img 
        src={src}
        alt="Loading Animation"
        className={`w-64 h-64 object-cover border-0 ${className}`}
      />
    </div>
  );
}