import Image from "next/image";
import { ImageIcon, Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { cn } from "@/lib/utils";

type RaceMediaProps = {
  src?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  children?: ReactNode;
  /** Blurred letterbox fill behind the photo. Skip on dense lists (extra decode/paint). */
  backdrop?: boolean;
};

export function RaceMedia({ src, alt, sizes, priority = false, className, children, backdrop = true }: RaceMediaProps) {
  return (
    <div className={cn("relative overflow-hidden bg-[var(--surface-soft)]", className)}>
      {src ? (
        <>
          {backdrop ? (
            <>
              <Image
                src={src}
                alt=""
                fill
                sizes={sizes}
                aria-hidden="true"
                className="scale-110 object-cover opacity-25 blur-xl"
              />
              <div className="absolute inset-0 bg-black/5" aria-hidden="true" />
            </>
          ) : null}
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            className="object-contain p-2"
          />
          <ImageLightbox src={src} alt={alt} triggerClassName="absolute inset-0 z-10">
            <span className="sr-only">View full image</span>
            <span className="absolute bottom-3 end-3 inline-flex size-9 items-center justify-center rounded-lg bg-black/65 text-white shadow-sm backdrop-blur transition group-hover:bg-black/80">
              <Maximize2 className="size-4" aria-hidden="true" />
            </span>
          </ImageLightbox>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]">
          <ImageIcon className="size-8" aria-hidden="true" />
          <span className="sr-only">No race image available</span>
        </div>
      )}
      <div className="pointer-events-none relative z-20">{children}</div>
    </div>
  );
}
