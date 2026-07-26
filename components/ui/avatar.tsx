import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/** 프로필 이미지가 있으면 next/image로, 없으면 호출부가 넘긴 fallback(이니셜 등)을 그대로 렌더링한다. */
export function Avatar({
  src,
  size,
  alt = "",
  fallback,
  className,
}: {
  src?: string | null;
  size: number;
  alt?: string;
  fallback: React.ReactNode;
  className?: string;
}) {
  if (!src) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
