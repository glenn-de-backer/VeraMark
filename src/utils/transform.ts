import type { Anchor, TransformConfig } from "../models/label";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function anchorPoint(anchor: Anchor, imageW: number, imageH: number): { x: number; y: number } {
  switch (anchor) {
    case "TopLeft":
      return { x: 0, y: 0 };
    case "TopCenter":
      return { x: imageW / 2, y: 0 };
    case "TopRight":
      return { x: imageW, y: 0 };
    case "Center":
      return { x: imageW / 2, y: imageH / 2 };
    case "BottomLeft":
      return { x: 0, y: imageH };
    case "BottomCenter":
      return { x: imageW / 2, y: imageH };
    case "BottomRight":
      return { x: imageW, y: imageH };
  }
}

/** The corner/edge pivot of the label rect that snaps onto the image anchor. */
function labelPivot(anchor: Anchor, labelW: number, labelH: number): { x: number; y: number } {
  switch (anchor) {
    case "TopLeft":
      return { x: 0, y: 0 };
    case "TopCenter":
      return { x: labelW / 2, y: 0 };
    case "TopRight":
      return { x: labelW, y: 0 };
    case "Center":
      return { x: labelW / 2, y: labelH / 2 };
    case "BottomLeft":
      return { x: 0, y: labelH };
    case "BottomCenter":
      return { x: labelW / 2, y: labelH };
    case "BottomRight":
      return { x: labelW, y: labelH };
  }
}

/**
 * Axis direction a positive offset moves the label toward the image interior,
 * per anchor. Mirrored EXACTLY by `engine::compositor::offset_direction`.
 *
 * - Corner / edge anchors: the offset always pushes away from the anchored
 *   edge (e.g. `BottomRight` nudge = left/up, `TopLeft` nudge = right/down).
 * - Center / centered anchors: there is no edge to push away from, so +X
 *   always moves right and +Y always moves down (fixed convention).
 *
 * Offsets are always non-negative magnitudes.
 */
export function offsetDirection(anchor: Anchor): { x: 1 | -1; y: 1 | -1 } {
  switch (anchor) {
    case "TopLeft":
    case "TopCenter":
    case "Center":
      return { x: 1, y: 1 };
    case "TopRight":
      return { x: -1, y: 1 };
    case "BottomLeft":
    case "BottomCenter":
      return { x: 1, y: -1 };
    case "BottomRight":
      return { x: -1, y: -1 };
  }
}

/**
 * `OverlayTransformBuilder` equivalent. Computes the destination rectangle of
 * the label inside the image:
 *
 *   1. Label width = min(imageW, imageH) × scale  (aspect preserved)
 *   2. Label pivot snaps to the cardinal anchor point of the image
 *   3. Pivot is shifted by the non-negative X/Y offset (always toward the
 *      image interior from the anchor) before being clamped fully on-canvas
 *
 * This function is mirrored EXACTLY by `engine::compositor` on the Rust side
 * so the live preview is WYSIWYG with the exported result.
 */
export function computeOverlayRect(
  imageW: number,
  imageH: number,
  labelW: number,
  labelH: number,
  transform: TransformConfig,
): Rect {
  const imageWf = Math.max(1, imageW);
  const imageHf = Math.max(1, imageH);
  const base = Math.min(imageWf, imageHf);

  const scale = clamp(transform.scale, 0.01, 1.0);
  const labelWidth = Math.max(1, Math.round(base * scale));
  const labelHeight = Math.max(1, Math.round(labelWidth * (labelH / Math.max(1, labelW))));

  const imagePt = anchorPoint(transform.anchor, imageWf, imageHf);
  const pivot = labelPivot(transform.anchor, labelWidth, labelHeight);

  // Non-negative magnitude; negative values are rejected (clamped to 0).
  const offsetX = Math.max(0, transform.offsetX);
  const offsetY = Math.max(0, transform.offsetY);

  // Positive offsets always push the label toward the image interior.
  const direction = offsetDirection(transform.anchor);

  let x = Math.round(imagePt.x - pivot.x + direction.x * offsetX);
  let y = Math.round(imagePt.y - pivot.y + direction.y * offsetY);

  // Keep the label fully visible inside the image bounds.
  x = Math.round(clamp(x, 0, imageWf - labelWidth));
  y = Math.round(clamp(y, 0, imageHf - labelHeight));

  return { x, y, w: labelWidth, h: labelHeight };
}