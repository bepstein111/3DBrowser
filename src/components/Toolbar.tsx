import type { DirListing } from "../lib/api";
import { isWebMode } from "../lib/api";

interface Props {
  listing: DirListing | null;
  loading: boolean;
  showAll: boolean;
  tileSize: number;
  onNavigate: (path: string) => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onToggleShowAll: (value: boolean) => void;
  onTileSize: (value: number) => void;
}

export default function Toolbar({
  listing,
  loading,
  showAll,
  tileSize,
  onNavigate,
  onOpenFolder,
  onRefresh,
  onToggleShowAll,
  onTileSize,
}: Props) {
  const segments = listing ? splitPath(listing.path) : [];

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        {!isWebMode && (
          <button type="button" className="btn" onClick={onOpenFolder}>
            Open Folder
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => listing?.parent && onNavigate(listing.parent)}
          disabled={!listing?.parent}
          title="Parent folder"
        >
          ↑ Up
        </button>
        <button type="button" className="btn" onClick={onRefresh} title="Reload and clear cache">
          ⟳ Refresh
        </button>

        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {segments.map((segment, index) => (
            <span key={segment.path} className="crumb">
              {index > 0 && <span className="crumb-sep">/</span>}
              <button
                type="button"
                className="crumb-btn"
                onClick={() => onNavigate(segment.path)}
                title={segment.path}
                data-drop-path={segment.path}
              >
                {segment.name}
              </button>
            </span>
          ))}
        </nav>

        <span className="toolbar-spacer" />

        <label className="control">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => onToggleShowAll(event.target.checked)}
          />
          Show all files
        </label>
        <label className="control">
          <span className="control-label">Size</span>
          <input
            type="range"
            min={96}
            max={320}
            step={8}
            value={tileSize}
            onChange={(event) => onTileSize(Number(event.target.value))}
          />
        </label>
        {loading && <span className="loading-pill">Loading…</span>}
      </div>
    </header>
  );
}

function splitPath(path: string): Array<{ name: string; path: string }> {
  const normalised = path.replace(/[\\/]+$/, "");
  const separator = normalised.includes("\\") ? "\\" : "/";
  const drive = /^[A-Za-z]:/.test(normalised);
  const parts = normalised.split(/[\\/]/).filter(Boolean);
  const result: Array<{ name: string; path: string }> = [];
  let accumulated = "";

  parts.forEach((part, index) => {
    if (index === 0 && drive) {
      accumulated = part + separator;
    } else if (index === 0 && normalised.startsWith(separator)) {
      accumulated = separator + part;
    } else {
      accumulated = accumulated.endsWith(separator)
        ? accumulated + part
        : accumulated + separator + part;
    }
    result.push({ name: part, path: accumulated });
  });

  return result;
}
