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
  /** X offset — absolute pixels, or % of image width when `offsetIsPercent`. */
  offsetX: number;
  /** Y offset — absolute pixels, or % of image height when `offsetIsPercent`. */
  offsetY: number;
  offsetIsPercent: boolean;
}

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
  offsetIsPercent: false,
};