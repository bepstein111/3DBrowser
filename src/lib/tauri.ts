import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  isModel: boolean;
  size: number;
  modifiedMs: number;
  extension: string | null;
}

export interface DirListing {
  path: string;
  parent: string | null;
  entries: DirEntry[];
}

export function listDir(path: string): Promise<DirListing> {
  return invoke<DirListing>("list_dir", { path });
}

export async function readFile(path: string): Promise<ArrayBuffer> {
  const result = await invoke<ArrayBuffer | number[]>("read_file", { path });
  if (result instanceof ArrayBuffer) return result;
  if (ArrayBuffer.isView(result)) {
    return (result as ArrayBufferView).buffer as ArrayBuffer;
  }
  return new Uint8Array(result as number[]).buffer;
}

export function homeDir(): Promise<string> {
  return invoke<string>("home_dir");
}

export async function pickFolder(defaultPath?: string): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath,
  });
  return typeof selected === "string" ? selected : null;
}

export function readThumbnail(
  entry: DirEntry,
  version: number,
): Promise<string | null> {
  return invoke<string | null>("read_thumbnail", {
    path: entry.path,
    modifiedMs: entry.modifiedMs,
    size: entry.size,
    version,
  });
}

export function writeThumbnail(
  entry: DirEntry,
  version: number,
  data: string,
): Promise<void> {
  return invoke<void>("write_thumbnail", {
    path: entry.path,
    modifiedMs: entry.modifiedMs,
    size: entry.size,
    version,
    data,
  });
}

export function clearThumbnailCache(): Promise<void> {
  return invoke<void>("clear_thumbnail_cache");
}

export function moveEntry(source: string, destDir: string): Promise<string> {
  return invoke<string>("move_entry", { source, destDir });
}

export function copyEntries(paths: string[], destDir: string): Promise<string[]> {
  return invoke<string[]>("copy_entries", { paths, destDir });
}
