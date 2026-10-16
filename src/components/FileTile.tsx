import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import type { DirEntry } from "../lib/api";
import { isWebMode } from "../lib/api";
import { getThumbnail, peekThumbnail } from "../lib/thumbnails";
import { formatForExtension } from "../formats";
import { formatBytes } from "../lib/format";
import { INTERNAL_DRAG_TYPE, startEntryDrag } from "../lib/dragdrop";
import { pathsEqual } from "../lib/paths";
import { useBookmarks } from "../state/BookmarksContext";

interface Props {
  entry: DirEntry;
  onOpen: (entry: DirEntry) => void;
  onContextMenu: (entry: DirEntry, x: number, y: number) => void;
  isCut: boolean;
}

export default function FileTile({ entry, onOpen, onContextMenu, isCut }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState<string | undefined>(() => peekThumbnail(entry));
  const [failed, setFailed] = useState(false);
  const format = formatForExtension(entry.extension);
  const { bookmarks, toggleBookmark } = useBookmarks();
  const bookmarked = bookmarks.some((bookmark) => pathsEqual(bookmark.path, entry.path));

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu(entry, event.clientX, event.clientY);
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    if ((event.target as HTMLElement).closest("[data-star]")) {
      event.preventDefault();
      return;
    }
    if (isWebMode) {
      // Browser mode: use native HTML5 drag and drop for in-app moves.
      event.dataTransfer.setData(INTERNAL_DRAG_TYPE, entry.path);
      event.dataTransfer.setData("text/plain", entry.path);
      event.dataTransfer.effectAllowed = "copyMove";
      return;
    }
    event.preventDefault();
    startEntryDrag(entry, thumb);
  };

  useEffect(() => {
    setThumb(peekThumbnail(entry));
    setFailed(false);
  }, [entry]);

  useEffect(() => {
    if (entry.isDir || thumb || failed) return;
    const node = ref.current;
    if (!node) return;

    const load = () => {
      getThumbnail(entry)
        .then((url) => setThumb(url))
        .catch(() => setFailed(true));
    };

    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }

    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [entry, thumb, failed]);

  if (entry.isDir) {
    return (
      <button
        ref={ref}
        type="button"
        className={`tile folder-tile${isCut ? " cut" : ""}`}
        onClick={() => onOpen(entry)}
        onContextMenu={handleContextMenu}
        title={entry.name}
        draggable
        onDragStart={handleDragStart}
        data-drop-path={entry.path}
      >
        <span className="tile-art">
          <span className="folder-icon" aria-hidden>
            📁
          </span>
          <span
            role="button"
            tabIndex={-1}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark folder"}
            className={`tile-star${bookmarked ? " is-active" : ""}`}
            data-star
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              toggleBookmark(entry.path, entry.name);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {bookmarked ? "★" : "☆"}
          </span>
        </span>
        <span className="tile-caption">
          <span className="tile-name">{entry.name}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      className={`tile model-tile${isCut ? " cut" : ""}`}
      onClick={() => onOpen(entry)}
      onContextMenu={handleContextMenu}
      title={entry.name}
      draggable
      onDragStart={handleDragStart}
    >
      <span className="tile-art">
        {thumb ? (
          <img className="tile-image" src={thumb} alt="" draggable={false} />
        ) : failed ? (
          <span className="tile-fallback" aria-hidden>
            ⚠
          </span>
        ) : (
          <span className="tile-spinner" aria-hidden />
        )}
        {format && (
          <span className="tile-badge" style={{ background: format.badgeColor }}>
            {format.label}
          </span>
        )}
      </span>
      <span className="tile-caption">
        <span className="tile-name">{entry.name}</span>
        <span className="tile-size">{formatBytes(entry.size)}</span>
      </span>
    </button>
  );
}
