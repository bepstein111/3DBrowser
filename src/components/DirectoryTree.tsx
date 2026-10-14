import { useCallback, useEffect, useState } from "react";
import { listDir, type DirEntry } from "../lib/tauri";
import { baseName } from "../lib/format";

interface Props {
  rootPath: string;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export default function DirectoryTree({ rootPath, currentPath, onNavigate }: Props) {
  return (
    <div className="tree">
      <TreeItem
        key={rootPath}
        path={rootPath}
        name={baseName(rootPath)}
        depth={0}
        currentPath={currentPath}
        onNavigate={onNavigate}
        defaultExpanded
      />
    </div>
  );
}

interface ItemProps {
  path: string;
  name: string;
  depth: number;
  currentPath: string;
  onNavigate: (path: string) => void;
  defaultExpanded?: boolean;
}

function TreeItem({
  path,
  name,
  depth,
  currentPath,
  onNavigate,
  defaultExpanded = false,
}: ItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded || children !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    listDir(path)
      .then((listing) => {
        if (!cancelled) setChildren(listing.entries.filter((entry) => entry.isDir));
      })
      .catch(() => {
        if (!cancelled) setChildren([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, children, loading, path]);

  const toggle = useCallback(() => setExpanded((value) => !value), []);
  const active = currentPath === path;

  return (
    <div className="tree-node">
      <div
        className={`tree-row${active ? " active" : ""}`}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        <button
          type="button"
          className="tree-toggle"
          onClick={toggle}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {loading ? "…" : expanded ? "▾" : "▸"}
        </button>
        <button
          type="button"
          className="tree-label"
          onClick={() => onNavigate(path)}
          title={path}
        >
          {name}
        </button>
      </div>
      {expanded && children !== null && (
        <div className="tree-children">
          {children.map((child) => (
            <TreeItem
              key={child.path}
              path={child.path}
              name={child.name}
              depth={depth + 1}
              currentPath={currentPath}
              onNavigate={onNavigate}
            />
          ))}
          {children.length === 0 && (
            <div className="tree-empty" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>
              no subfolders
            </div>
          )}
        </div>
      )}
    </div>
  );
}
