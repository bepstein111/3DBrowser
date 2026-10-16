import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadBookmarks, saveBookmarks, type Bookmark } from "../lib/api";
import { pathsEqual } from "../lib/paths";
import { baseName } from "../lib/format";

interface BookmarksContextValue {
  bookmarks: Bookmark[];
  isBookmarked: (path: string) => boolean;
  addBookmark: (path: string, name?: string) => void;
  toggleBookmark: (path: string, name?: string) => void;
  removeBookmark: (id: string) => void;
  renameBookmark: (id: string, name: string) => void;
  moveBookmark: (from: number, to: number) => void;
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadBookmarks()
      .then((stored) => {
        if (!cancelled) setBookmarks(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loaded) void saveBookmarks(bookmarks).catch(() => undefined);
  }, [bookmarks, loaded]);

  const isBookmarked = useCallback(
    (path: string) => bookmarks.some((bookmark) => pathsEqual(bookmark.path, path)),
    [bookmarks],
  );

  const makeBookmark = (path: string, name?: string): Bookmark => ({
    id: createId(),
    name: name || baseName(path) || path,
    path,
    createdAt: Date.now(),
  });

  const addBookmark = useCallback((path: string, name?: string) => {
    setBookmarks((prev) =>
      prev.some((bookmark) => pathsEqual(bookmark.path, path))
        ? prev
        : [...prev, makeBookmark(path, name)],
    );
  }, []);

  const toggleBookmark = useCallback((path: string, name?: string) => {
    setBookmarks((prev) =>
      prev.some((bookmark) => pathsEqual(bookmark.path, path))
        ? prev.filter((bookmark) => !pathsEqual(bookmark.path, path))
        : [...prev, makeBookmark(path, name)],
    );
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((bookmark) => bookmark.id !== id));
  }, []);

  const renameBookmark = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    setBookmarks((prev) =>
      prev.map((bookmark) =>
        bookmark.id === id ? { ...bookmark, name: trimmed || bookmark.name } : bookmark,
      ),
    );
  }, []);

  const moveBookmark = useCallback((from: number, to: number) => {
    setBookmarks((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const value = useMemo<BookmarksContextValue>(
    () => ({
      bookmarks,
      isBookmarked,
      addBookmark,
      toggleBookmark,
      removeBookmark,
      renameBookmark,
      moveBookmark,
    }),
    [
      bookmarks,
      isBookmarked,
      addBookmark,
      toggleBookmark,
      removeBookmark,
      renameBookmark,
      moveBookmark,
    ],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks(): BookmarksContextValue {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error("useBookmarks must be used within a BookmarksProvider");
  }
  return context;
}
