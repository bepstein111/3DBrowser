import * as tauri from "./tauri";
import * as web from "./web";
import type { Bookmark, DirEntry, DirListing } from "./tauri";

export type { Bookmark, DirEntry, DirListing };

/**
 * True when the UI runs in a plain browser (served by Caddy in the Docker
 * setup) rather than inside the Tauri desktop shell. In that mode the backend
 * is reached over HTTP and reads from a folder mounted into the container.
 */
export const isWebMode =
  typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);

export function listDir(path: string): Promise<DirListing> {
  return isWebMode ? web.listDir(path) : tauri.listDir(path);
}

export function readFile(path: string): Promise<ArrayBuffer> {
  return isWebMode ? web.readFile(path) : tauri.readFile(path);
}

export function homeDir(): Promise<string> {
  return isWebMode ? web.homeDir() : tauri.homeDir();
}

export function pickFolder(defaultPath?: string): Promise<string | null> {
  return isWebMode ? web.pickFolder() : tauri.pickFolder(defaultPath);
}

export function moveEntry(source: string, destDir: string): Promise<string> {
  return isWebMode ? web.moveEntry(source, destDir) : tauri.moveEntry(source, destDir);
}

export function copyEntries(paths: string[], destDir: string): Promise<string[]> {
  return isWebMode ? web.copyEntries(paths, destDir) : tauri.copyEntries(paths, destDir);
}

export function createFolder(parent: string, name: string): Promise<string> {
  return isWebMode ? web.createFolder(parent, name) : tauri.createFolder(parent, name);
}

export function deleteEntry(path: string): Promise<void> {
  return isWebMode ? web.deleteEntry(path) : tauri.deleteEntry(path);
}

export function readThumbnail(entry: DirEntry, version: number): Promise<string | null> {
  return isWebMode ? web.readThumbnail(entry, version) : tauri.readThumbnail(entry, version);
}

export function writeThumbnail(
  entry: DirEntry,
  version: number,
  data: string,
): Promise<void> {
  return isWebMode
    ? web.writeThumbnail(entry, version, data)
    : tauri.writeThumbnail(entry, version, data);
}

export function clearThumbnailCache(): Promise<void> {
  return isWebMode ? web.clearThumbnailCache() : tauri.clearThumbnailCache();
}

export function loadBookmarks(): Promise<Bookmark[]> {
  return isWebMode ? web.loadBookmarks() : tauri.loadBookmarks();
}

export function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
  return isWebMode ? web.saveBookmarks(bookmarks) : tauri.saveBookmarks(bookmarks);
}
