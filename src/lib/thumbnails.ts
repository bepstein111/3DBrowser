import { formatForExtension } from "../formats";
import { renderThumbnail, THUMBNAIL_VERSION } from "../three/thumbnail";
import { readFile, readThumbnail, writeThumbnail, type DirEntry } from "./api";

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

const MAX_CONCURRENT = 2;
let active = 0;
const waiting: Array<() => void> = [];

function pump(): void {
  while (active < MAX_CONCURRENT && waiting.length > 0) {
    const run = waiting.shift()!;
    active += 1;
    run();
  }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiting.push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    });
    pump();
  });
}

function cacheKey(entry: DirEntry): string {
  return `${entry.path}::${entry.modifiedMs}::${entry.size}::${THUMBNAIL_VERSION}`;
}

export function peekThumbnail(entry: DirEntry): string | undefined {
  return memory.get(cacheKey(entry));
}

/**
 * Returns a cached data URL for the entry, generating it if needed. Disk cache
 * is checked first so thumbnails persist across sessions.
 */
export function getThumbnail(entry: DirEntry): Promise<string> {
  const key = cacheKey(entry);
  const cached = memory.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const fromDisk = await readThumbnail(entry, THUMBNAIL_VERSION).catch(() => null);
    if (fromDisk) {
      const url = `data:image/png;base64,${fromDisk}`;
      memory.set(key, url);
      return url;
    }

    return enqueue(async () => {
      const ready = memory.get(key);
      if (ready) return ready;

      const format = formatForExtension(entry.extension);
      if (!format) {
        throw new Error(`Unsupported format: ${entry.extension ?? "unknown"}`);
      }

      const data = await readFile(entry.path);
      const object = await format.load({
        path: entry.path,
        name: entry.name,
        extension: entry.extension ?? "",
        data,
      });
      const url = await renderThumbnail(object);
      memory.set(key, url);

      const base64 = url.slice(url.indexOf(",") + 1);
      writeThumbnail(entry, THUMBNAIL_VERSION, base64).catch(() => undefined);
      return url;
    });
  })();

  inflight.set(key, promise);
  promise.finally(() => inflight.delete(key)).catch(() => undefined);
  return promise;
}

export function invalidateAllThumbnails(): void {
  memory.clear();
}
