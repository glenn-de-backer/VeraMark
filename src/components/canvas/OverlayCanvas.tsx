import { useEffect, useRef, useState } from "react";
import type { TransformConfig } from "../../models/label";
import { computeOverlayRect } from "../../utils/transform";
import { Spinner } from "../ui/Spinner";

interface OverlayCanvasProps {
  src: string;
  labelSrc: string | null;
  originalWidth: number;
  originalHeight: number;
  transform: TransformConfig;
  className?: string;
}

interface LoadedImage {
  element: HTMLImageElement;
  width: number;
  height: number;
}

const IMAGE_CACHE = new Map<string, LoadedImage>();

async function loadImage(src: string): Promise<LoadedImage> {
  const cached = IMAGE_CACHE.get(src);
  if (cached) return cached;

  const element = new Image();
  element.src = src;
  await new Promise<void>((resolve, reject) => {
    element.onload = () => resolve();
    element.onerror = () => reject(new Error("Failed to load image"));
  });

  const loaded: LoadedImage = {
    element,
    width: element.naturalWidth,
    height: element.naturalHeight,
  };
  if (IMAGE_CACHE.size > 64) IMAGE_CACHE.clear();
  IMAGE_CACHE.set(src, loaded);
  return loaded;
}

/**
 * Renders a base image fitted inside its container and draws the selected
 * label at the transform-computed rect. Used both for the single-image
 * viewport and the batch gallery thumbnails so preview == export.
 */
export function OverlayCanvas({
  src,
  labelSrc,
  originalWidth,
  originalHeight,
  transform,
  className = "",
}: OverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerSize.w <= 0 || containerSize.h <= 0) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const base = await loadImage(src);
        if (cancelled) return;
        const label = labelSrc ? await loadImage(labelSrc) : null;
        if (cancelled) return;

        const scale = Math.min(
          containerSize.w / Math.max(1, originalWidth),
          containerSize.h / Math.max(1, originalHeight),
        );
        const drawW = originalWidth * scale;
        const drawH = originalHeight * scale;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(drawW * dpr));
        canvas.height = Math.max(1, Math.round(drawH * dpr));

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, drawW, drawH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(base.element, 0, 0, drawW, drawH);

        if (label) {
          const rect = computeOverlayRect(
            originalWidth,
            originalHeight,
            label.width,
            label.height,
            transform,
          );
          ctx.drawImage(
            label.element,
            rect.x * scale,
            rect.y * scale,
            rect.w * scale,
            rect.h * scale,
          );
        }
      } catch (error) {
        console.error("OverlayCanvas render failed:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, labelSrc, originalWidth, originalHeight, transform, containerSize]);

  return (
    <div ref={containerRef} className={`relative h-full w-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2"
      />
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-950/30">
          <Spinner className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}