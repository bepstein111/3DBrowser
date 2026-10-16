import type { DirEntry, DirListing } from "../lib/api";
import { isModelFile } from "../formats";
import FileTile from "./FileTile";

interface Props {
  listing: DirListing;
  showAll: boolean;
  tileSize: number;
  onOpenFolder: (entry: DirEntry) => void;
  onOpenModel: (entry: DirEntry) => void;
}

export default function FileGrid({
  listing,
  showAll,
  tileSize,
  onOpenFolder,
  onOpenModel,
}: Props) {
  const visible = listing.entries.filter(
    (entry) => entry.isDir || showAll || isModelFile(entry.name, entry.extension),
  );

  if (visible.length === 0) {
    return (
      <div className="empty-state" data-drop-path={listing.path}>
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
    >
      {visible.map((entry) => (
        <FileTile
          key={entry.path}
          entry={entry}
          onOpen={(target) => (target.isDir ? onOpenFolder(target) : onOpenModel(target))}
        />
      ))}
    </div>
  );
}
