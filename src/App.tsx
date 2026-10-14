import { useCallback, useEffect, useState } from "react";
import "./formats";
import "./App.css";
import {
  clearThumbnailCache,
  homeDir,
  listDir,
  pickFolder,
  type DirEntry,
  type DirListing,
} from "./lib/tauri";
import { invalidateAllThumbnails } from "./lib/thumbnails";
import DirectoryTree from "./components/DirectoryTree";
import FileGrid from "./components/FileGrid";
import Toolbar from "./components/Toolbar";
import ViewerModal from "./components/ViewerModal";

export default function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [listing, setListing] = useState<DirListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [tileSize, setTileSize] = useState(168);
  const [openEntry, setOpenEntry] = useState<DirEntry | null>(null);

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
        {rootPath && (
          <aside className="sidebar">
            <DirectoryTree
              rootPath={rootPath}
              currentPath={listing?.path ?? ""}
              onNavigate={(path) => void navigate(path)}
            />
          </aside>
        )}
        <main className="content">
          {error && <div className="banner error">{error}</div>}
          {listing ? (
            <FileGrid
              listing={listing}
              showAll={showAll}
              tileSize={tileSize}
              onOpenFolder={openFolderEntry}
              onOpenModel={setOpenEntry}
            />
          ) : (
            !error && <div className="empty-state">Loading…</div>
          )}
        </main>
      </div>
      {openEntry && <ViewerModal entry={openEntry} onClose={closeViewer} />}
    </div>
  );
}
