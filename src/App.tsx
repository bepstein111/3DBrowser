import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./formats";
import "./App.css";
import {
  clearThumbnailCache,
  copyEntries,
  createFolder,
  deleteEntry,
  homeDir,
  isWebMode,
  listDir,
  moveEntry,
  pickFolder,
  type DirEntry,
  type DirListing,
} from "./lib/api";
import { invalidateAllThumbnails } from "./lib/thumbnails";
import {
  clearDropHighlight,
  dropTargetAt,
  dropTargetAtPoint,
  highlightDropTarget,
  INTERNAL_DRAG_TYPE,
  isInternalDrag,
  samePath,
} from "./lib/dragdrop";
import BookmarksPanel from "./components/BookmarksPanel";
import ConfirmDialog from "./components/ConfirmDialog";
import ContextMenu from "./components/ContextMenu";
import FileGrid from "./components/FileGrid";
import PromptDialog from "./components/PromptDialog";
import Toolbar from "./components/Toolbar";
import ViewerModal from "./components/ViewerModal";

interface Clipboard {
  mode: "cut" | "copy";
  paths: string[];
}

export default function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [listing, setListing] = useState<DirListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [tileSize, setTileSize] = useState(168);
  const [openEntry, setOpenEntry] = useState<DirEntry | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; entry: DirEntry | null } | null>(
    null,
  );
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DirEntry | null>(null);

  const listingPathRef = useRef<string | null>(null);
  useEffect(() => {
    listingPathRef.current = listing?.path ?? null;
  }, [listing?.path]);

  const navigate = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDir(path);
      setListing(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (paths: string[], destDir: string, internal: boolean) => {
      try {
        if (internal && paths.length === 1) {
          if (samePath(paths[0], destDir)) return;
          await moveEntry(paths[0], destDir);
        } else {
          await copyEntries(paths, destDir);
        }
        if (listingPathRef.current) {
          await navigate(listingPathRef.current);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (isWebMode) {
      const onDragOver = (event: globalThis.DragEvent) => {
        event.preventDefault();
        if (Array.from(event.dataTransfer?.types ?? []).includes(INTERNAL_DRAG_TYPE)) {
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          const target = dropTargetAtPoint(event.clientX, event.clientY);
          highlightDropTarget(target?.element ?? null);
        }
      };
      const onDrop = (event: globalThis.DragEvent) => {
        event.preventDefault();
        clearDropHighlight();
        const path = event.dataTransfer?.getData(INTERNAL_DRAG_TYPE);
        if (!path) return;
        const target = dropTargetAtPoint(event.clientX, event.clientY);
        const destDir = target?.path ?? listingPathRef.current;
        if (destDir) void handleDrop([path], destDir, true);
      };
      const onDragEnd = () => clearDropHighlight();

      window.addEventListener("dragover", onDragOver);
      window.addEventListener("drop", onDrop);
      window.addEventListener("dragend", onDragEnd);
      return () => {
        window.removeEventListener("dragover", onDragOver);
        window.removeEventListener("drop", onDrop);
        window.removeEventListener("dragend", onDragEnd);
      };
    }

    let unlisten: (() => void) | undefined;
    let disposed = false;

    getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        const scale = window.devicePixelRatio || 1;

        if (payload.type === "over" || payload.type === "enter") {
          const target = dropTargetAt(payload.position, scale);
          highlightDropTarget(target?.element ?? null);
        } else if (payload.type === "leave") {
          clearDropHighlight();
        } else if (payload.type === "drop") {
          clearDropHighlight();
          const target = dropTargetAt(payload.position, scale);
          const destDir = target?.path ?? listingPathRef.current;
          const internal = payload.paths.length === 1 && isInternalDrag(payload.paths[0]);
          if (destDir) void handleDrop(payload.paths, destDir, internal);
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch((cause) => console.error("drag-drop listener failed", cause));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handleDrop]);

  useEffect(() => {
    let cancelled = false;
    homeDir()
      .then((home) => {
        if (cancelled) return;
        setRootPath(home);
        return navigate(home);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const openFolder = useCallback(async () => {
    const selected = await pickFolder(listing?.path ?? rootPath ?? undefined);
    if (!selected) return;
    setRootPath(selected);
    await navigate(selected);
  }, [listing?.path, rootPath, navigate]);

  const openFolderEntry = useCallback(
    (entry: DirEntry) => {
      void navigate(entry.path);
    },
    [navigate],
  );

  const refresh = useCallback(async () => {
    invalidateAllThumbnails();
    await clearThumbnailCache().catch(() => undefined);
    if (listing?.path) await navigate(listing.path);
  }, [listing?.path, navigate]);

  const closeViewer = useCallback(() => setOpenEntry(null), []);

  const openContextMenu = useCallback((entry: DirEntry | null, x: number, y: number) => {
    setMenu({ x, y, entry });
  }, []);

  const contextFolder = useCallback((entry: DirEntry | null): string | null => {
    if (entry) return entry.isDir ? entry.path : listingPathRef.current;
    return listingPathRef.current;
  }, []);

  const isCut = useCallback(
    (entry: DirEntry) =>
      clipboard?.mode === "cut" && clipboard.paths.some((path) => samePath(path, entry.path)),
    [clipboard],
  );

  const pasteClipboard = useCallback(
    async (entry: DirEntry | null) => {
      const target = contextFolder(entry);
      if (!clipboard || !target) return;
      try {
        if (clipboard.mode === "cut") {
          for (const path of clipboard.paths) {
            if (samePath(path, target)) continue;
            await moveEntry(path, target);
          }
          setClipboard(null);
        } else {
          await copyEntries(clipboard.paths, target);
        }
        if (listingPathRef.current) await navigate(listingPathRef.current);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [clipboard, contextFolder, navigate],
  );

  const confirmNewFolder = useCallback(
    async (name: string) => {
      const parent = newFolderParent;
      setNewFolderParent(null);
      if (!parent) return;
      try {
        await createFolder(parent, name);
        if (listingPathRef.current) await navigate(listingPathRef.current);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [newFolderParent, navigate],
  );

  const confirmDelete = useCallback(async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await deleteEntry(target.path);
      if (listingPathRef.current) await navigate(listingPathRef.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [pendingDelete, navigate]);

  return (
    <div className="app">
      <Toolbar
        listing={listing}
        loading={loading}
        showAll={showAll}
        tileSize={tileSize}
        onNavigate={(path) => void navigate(path)}
        onOpenFolder={openFolder}
        onRefresh={refresh}
        onToggleShowAll={setShowAll}
        onTileSize={setTileSize}
      />
      <div className="workspace">
        <aside className="sidebar">
          <BookmarksPanel
            currentPath={listing?.path ?? ""}
            onNavigate={(path) => void navigate(path)}
          />
        </aside>
        <main className="content">
          {error && <div className="banner error">{error}</div>}
          {listing ? (
            <FileGrid
              listing={listing}
              showAll={showAll}
              tileSize={tileSize}
              onOpenFolder={openFolderEntry}
              onOpenModel={setOpenEntry}
              onContextMenu={openContextMenu}
              isCut={isCut}
            />
          ) : (
            !error && <div className="empty-state">Loading…</div>
          )}
        </main>
      </div>
      {openEntry && <ViewerModal entry={openEntry} onClose={closeViewer} />}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Cut",
              disabled: !menu.entry,
              onSelect: () => {
                if (menu.entry) setClipboard({ mode: "cut", paths: [menu.entry.path] });
              },
            },
            {
              label: "Copy",
              disabled: !menu.entry,
              onSelect: () => {
                if (menu.entry) setClipboard({ mode: "copy", paths: [menu.entry.path] });
              },
            },
            {
              label: "Paste",
              disabled: !clipboard,
              onSelect: () => void pasteClipboard(menu.entry),
            },
            {
              label: "New Folder",
              separatorBefore: true,
              onSelect: () => {
                const parent = contextFolder(menu.entry);
                if (parent) setNewFolderParent(parent);
              },
            },
            {
              label: "Delete",
              disabled: !menu.entry,
              onSelect: () => {
                if (menu.entry) setPendingDelete(menu.entry);
              },
            },
          ]}
        />
      )}
      {newFolderParent && (
        <PromptDialog
          title="New Folder"
          label="Folder name"
          initialValue="New Folder"
          confirmLabel="Create"
          onConfirm={confirmNewFolder}
          onCancel={() => setNewFolderParent(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete"
          danger
          confirmLabel="Delete"
          message={
            pendingDelete.isDir
              ? `Delete the folder "${pendingDelete.name}" and everything in it? This cannot be undone.`
              : `Delete "${pendingDelete.name}"? This cannot be undone.`
          }
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
