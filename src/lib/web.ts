import type { Bookmark, DirEntry, DirListing } from "./tauri";

const BOOKMARKS_KEY = "3dbrowser.bookmarks";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function homeDir(): Promise<string> {
  return Promise.resolve("/");
}

export function pickFolder(): Promise<string | null> {
  return Promise.resolve(null);
}

export function listDir(path: string): Promise<DirListing> {
  return requestJson<DirListing>(`/api/list?path=${encodeURIComponent(path)}`);
}

export async function readFile(path: string): Promise<ArrayBuffer> {
  const response = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
  if (!response.ok) throw new Error(`Failed to read ${path}`);
  return response.arrayBuffer();
}

export async function moveEntry(source: string, destDir: string): Promise<string> {
  const body = await requestJson<{ path: string }>("/api/move", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source, destDir }),
  });
  return body.path;
}

export async function copyEntries(paths: string[], destDir: string): Promise<string[]> {
  const body = await requestJson<{ paths: string[] }>("/api/copy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ paths, destDir }),
  });
  return body.paths;
}

export async function createFolder(parent: string, name: string): Promise<string> {
  const body = await requestJson<{ path: string }>("/api/new-folder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parent, name }),
  });
  return body.path;
}

export async function deleteEntry(path: string): Promise<void> {
  await requestJson<{ ok: boolean }>("/api/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

export function readThumbnail(
  _entry: DirEntry,
  _version: number,
): Promise<string | null> {
  return Promise.resolve(null);
}

export function writeThumbnail(
  _entry: DirEntry,
  _version: number,
  _data: string,
): Promise<void> {
  return Promise.resolve();
}

export function clearThumbnailCache(): Promise<void> {
  return Promise.resolve();
}

export function loadBookmarks(): Promise<Bookmark[]> {
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_KEY);
    return Promise.resolve(raw ? (JSON.parse(raw) as Bookmark[]) : []);
  } catch {
    return Promise.resolve([]);
  }
}

export function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
  try {
    window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {
    // ignore quota / private-mode errors
  }
  return Promise.resolve();
}
