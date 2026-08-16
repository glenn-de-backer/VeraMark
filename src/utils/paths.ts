export interface PathResult {
  dir: string;
  stem: string;
}

export function splitDirStem(pathValue: string): PathResult {
  const normalized = pathValue.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const dot = normalized.lastIndexOf(".");
  const dir = slash >= 0 ? normalized.slice(0, slash + 1) : "";
  const stem =
    dot > slash
      ? normalized.slice(slash + 1, dot)
      : normalized.slice(slash + 1);
  return { dir, stem };
}

export function defaultOutputPath(
  inputPath: string,
  format: "png" | "jpeg",
): string {
  const { dir, stem } = splitDirStem(inputPath);
  return `${dir}${stem}-marked.${format}`;
}

export function fileName(pathValue: string): string {
  const normalized = pathValue.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? pathValue;
}