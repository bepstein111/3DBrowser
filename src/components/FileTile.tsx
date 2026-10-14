import { useEffect, useRef, useState } from "react";
import type { DirEntry } from "../lib/tauri";
import { getThumbnail, peekThumbnail } from "../lib/thumbnails";
import { formatForExtension } from "../formats";
import { formatBytes } from "../lib/format";

interface Props {
  entry: DirEntry;
  onOpen: (entry: DirEntry) => void;
}

export default function FileTile({ entry, onOpen }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState<string | undefined>(() => peekThumbnail(entry));
  const [failed, setFailed] = useState(false);
  const format = formatForExtension(entry.extension);

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
        className="tile folder-tile"
        onClick={() => onOpen(entry)}
        title={entry.name}
      >
        <span className="tile-art">
          <span className="folder-icon" aria-hidden>
            📁
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
      className="tile model-tile"
      onClick={() => onOpen(entry)}
      title={entry.name}
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
