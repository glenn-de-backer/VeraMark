/**
 * Label / overlay models. These shapes are mirrored 1:1 by the Rust
 * command structs in `src-tauri/src/commands/`.
 */

export type Anchor =
  | "TopLeft"
  | "TopCenter"
  | "TopRight"
  | "Center"
  | "BottomLeft"
  | "BottomCenter"
  | "BottomRight";

export interface TransformConfig {
  anchor: Anchor;
  /** Normalized relative scale (0.01..1.0) of the image bounding box. */
  scale: number;
  /**
   * Non-negative X offset (px) from the anchor point, always moving the label
   * toward the image interior. Negative values are clamped to 0.
   */
  offsetX: number;
  /**
   * Non-negative Y offset (px) from the anchor point, always moving the label
   * toward the image interior. Negative values are clamped to 0.
   */
  offsetY: number;
}

/** Upper bound (px) for the non-negative X/Y offset sliders. */
export const MAX_OFFSET_PX = 500;

export interface LabelAsset {
  /** File name (`ai-generated-v2.svg`) — the id the Rust backend keys on. */
  id: string;
  /** Human-friendly name derived from the file stem. */
  name: string;
  kind: "svg" | "png";
  /** Base64 data URL used for live preview rendering. */
  dataUrl: string;
}

export const ANCHOR_ORDER: readonly Anchor[] = [
  "TopLeft",
  "TopCenter",
  "TopRight",
  "Center",
  "BottomLeft",
  "BottomCenter",
  "BottomRight",
];

export const ANCHOR_LABELS: Record<Anchor, string> = {
  TopLeft: "Top Left",
  TopCenter: "Top Center",
  TopRight: "Top Right",
  Center: "Center",
  BottomLeft: "Bottom Left",
  BottomCenter: "Bottom Center",
  BottomRight: "Bottom Right",
};

export const DEFAULT_TRANSFORM: TransformConfig = {
  anchor: "BottomRight",
  scale: 0.25,
  offsetX: 0,
  offsetY: 0,
};