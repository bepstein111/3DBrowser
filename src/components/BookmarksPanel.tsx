import { useState, type DragEvent } from "react";
import { useBookmarks } from "../state/BookmarksContext";
import { pathsEqual } from "../lib/paths";
import type { Bookmark } from "../lib/api";

const REORDER_TYPE = "application/x-3dbrowser-bookmark-index";

interface Props {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export default function BookmarksPanel({ currentPath, onNavigate }: Props) {
  const { bookmarks, removeBookmark, renameBookmark, moveBookmark } = useBookmarks();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const startRename = (bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setDraft(bookmark.name);
  };

  const commitRename = () => {
    if (editingId) renameBookmark(editingId, draft);
    setEditingId(null);
  };

  const handleDragStart = (event: DragEvent<HTMLLIElement>, index: number) => {
    event.dataTransfer.setData(REORDER_TYPE, String(index));
    event.dataTransfer.effectAllowed = "move";
    setDragging(index);
  };

  const handleDragOver = (event: DragEvent<HTMLLIElement>, index: number) => {
    if (!Array.from(event.dataTransfer.types).includes(REORDER_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(index);
  };

  const handleDrop = (event: DragEvent<HTMLLIElement>, index: number) => {
    const from = Number(event.dataTransfer.getData(REORDER_TYPE));
    event.preventDefault();
    setDragging(null);
    setOver(null);
    if (!Number.isNaN(from)) moveBookmark(from, index);
  };

  return (
    <div className="bookmarks">
      <div className="bookmarks-header">
        <span className="bookmarks-title">Bookmarks</span>
        <span className="bookmarks-count">{bookmarks.length}</span>
      </div>

      {bookmarks.length === 0 ? (
        <p className="bookmarks-empty">
          No bookmarks yet.
          <br />
          Use the ★ button to bookmark a folder.
        </p>
      ) : (
        <ul className="bookmarks-list">
          {bookmarks.map((bookmark, index) => (
            <li
              key={bookmark.id}
              className={[
                "bookmark-row",
                pathsEqual(bookmark.path, currentPath) ? "active" : "",
                over === index ? "drop-target" : "",
                dragging === index ? "dragging" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable={editingId !== bookmark.id}
              onDragStart={(event) => handleDragStart(event, index)}
              onDragOver={(event) => handleDragOver(event, index)}
              onDrop={(event) => handleDrop(event, index)}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              {editingId === bookmark.id ? (
                <input
                  className="bookmark-input"
                  value={draft}
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename();
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="bookmark-label"
                  title={bookmark.path}
                  onClick={() => onNavigate(bookmark.path)}
                  onDoubleClick={() => startRename(bookmark)}
                >
                  <span className="bookmark-name">{bookmark.name}</span>
                  <span className="bookmark-path">{bookmark.path}</span>
                </button>
              )}
              <button
                type="button"
                className="bookmark-remove"
                title="Remove bookmark"
                onClick={() => removeBookmark(bookmark.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
