"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ImageWithFallback({
  src,
  alt,
  className,
  imageClassName,
  sizes,
  priority,
}: {
  src?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div className={cn("relative overflow-hidden bg-surface2", className)}>
      {showFallback ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(200,247,81,0.12),transparent_45%),linear-gradient(135deg,var(--surface-2),var(--surface))]">
          <ImageIcon className="h-8 w-8 text-faint" aria-hidden />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "(max-width: 768px) 100vw, 33vw"}
          priority={priority}
          onError={() => setFailed(true)}
          className={cn("object-cover", imageClassName)}
        />
      )}
    </div>
  );
}
