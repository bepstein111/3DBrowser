import { useEffect, useRef, useState } from "react";
import type { DirEntry } from "../lib/tauri";
import { readFile } from "../lib/tauri";
import { formatForExtension } from "../formats";
import { ModelViewer, type ViewerStats } from "../three/viewer";
import { disposeObject } from "../three/material";
import { formatBytes } from "../lib/format";

interface Props {
  entry: DirEntry;
  onClose: () => void;
}

export default function ViewerModal({ entry, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ModelViewer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [wireframe, setWireframe] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const viewer = new ModelViewer(container);
    viewerRef.current = viewer;
    let cancelled = false;

    setStatus("loading");
    setStats(null);
    setError("");

    (async () => {
      try {
        const format = formatForExtension(entry.extension);
        if (!format) throw new Error(`Unsupported format: ${entry.extension ?? entry.name}`);
        const data = await readFile(entry.path);
        const object = await format.load({
          path: entry.path,
          name: entry.name,
          extension: entry.extension ?? "",
          data,
        });
        if (cancelled) {
          disposeObject(object);
          return;
        }
        setStats(viewer.setObject(object));
        setStatus("ready");
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setStatus("error");
        }
      }
    })();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [entry, onClose]);

  useEffect(() => {
    viewerRef.current?.setWireframe(wireframe);
  }, [wireframe]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-name">{entry.name}</span>
            <span className="modal-sub">
              {formatBytes(entry.size)}
              {stats && ` · ${stats.triangles.toLocaleString()} tris · ${stats.meshes} mesh(es)`}
            </span>
          </div>
          <div className="modal-actions">
            <label className="control">
              <input
                type="checkbox"
                checked={wireframe}
                onChange={(event) => setWireframe(event.target.checked)}
              />
              Wireframe
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => viewerRef.current?.resetView()}
              disabled={status !== "ready"}
            >
              Reset view
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div ref={mountRef} className="viewer-mount" />
          {status === "loading" && <div className="viewer-overlay">Loading model…</div>}
          {status === "error" && <div className="viewer-overlay error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
