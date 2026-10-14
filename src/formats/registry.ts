import type { ModelFormat } from "./types";

const byId = new Map<string, ModelFormat>();
const byExtension = new Map<string, ModelFormat>();

/**
 * Register a format so the explorer can discover it. New formats only need to
 * call this once (see `formats/index.ts`); the UI derives everything – which
 * files are models, which extensions are supported – from this registry.
 */
export function registerFormat(format: ModelFormat): void {
  byId.set(format.id, format);
  for (const ext of format.extensions) {
    byExtension.set(ext.toLowerCase(), format);
  }
}

export function formatForExtension(ext: string | null | undefined): ModelFormat | undefined {
  if (!ext) return undefined;
  return byExtension.get(ext.toLowerCase());
}

export function isSupportedExtension(ext: string | null | undefined): boolean {
  return formatForExtension(ext) !== undefined;
}

export function isModelFile(name: string, ext: string | null | undefined): boolean {
  if (!ext && name.includes(".")) {
    ext = name.split(".").pop() ?? null;
  }
  return isSupportedExtension(ext);
}

export function allFormats(): ModelFormat[] {
  return [...byId.values()];
}

export function supportedExtensions(): string[] {
  return [...byExtension.keys()];
}
