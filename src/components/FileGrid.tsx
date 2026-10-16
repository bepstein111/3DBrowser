import { type MouseEvent } from "react";
import type { DirEntry, DirListing } from "../lib/api";
import { isModelFile } from "../formats";
import FileTile from "./FileTile";

interface Props {
  listing: DirListing;
  showAll: boolean;
  tileSize: number;
  onOpenFolder: (entry: DirEntry) => void;
  onOpenModel: (entry: DirEntry) => void;
  onContextMenu: (entry: DirEntry | null, x: number, y: number) => void;
  isCut: (entry: DirEntry) => boolean;
}

export default function FileGrid({
  listing,
  showAll,
  tileSize,
  onOpenFolder,
  onOpenModel,
  onContextMenu,
  isCut,
}: Props) {
  const visible = listing.entries.filter(
    (entry) => entry.isDir || showAll || isModelFile(entry.name, entry.extension),
  );

  const handleBackgroundMenu = (event: MouseEvent) => {
    event.preventDefault();
    onContextMenu(null, event.clientX, event.clientY);
  };

  if (visible.length === 0) {
    return (
      <div className="empty-state" data-drop-path={listing.path} onContextMenu={handleBackgroundMenu}>
        <p>No 3D models here.</p>
        <p className="empty-hint">Enable “Show all files” to see everything in this folder.</p>
      </div>
    );
  }

  return (
    <div
      className="file-grid"
      data-drop-path={listing.path}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}
      onContextMenu={handleBackgroundMenu}
    >
      {visible.map((entry) => (
        <FileTile
          key={entry.path}
          entry={entry}
          isCut={isCut(entry)}
          onContextMenu={onContextMenu}
          onOpen={(target) => (target.isDir ? onOpenFolder(target) : onOpenModel(target))}
        />
      ))}
    </div>
  );
}
