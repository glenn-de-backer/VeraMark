export interface ImageFileInfo {
  path: string;
  name: string;
  width: number;
  height: number;
}

export interface PreviewImage {
  /** Base64 data URL of the downscaled preview render. */
  dataUrl: string;
  /** Rendered preview dimensions (may be downscaled). */
  width: number;
  height: number;
  /** Original source dimensions — always used for transform math. */
  originalWidth: number;
  originalHeight: number;
}