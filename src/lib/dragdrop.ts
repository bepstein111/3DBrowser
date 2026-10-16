import { startDrag } from "@crabnebula/tauri-plugin-drag";
import type { DirEntry } from "./tauri";

/** Path of the entry currently being dragged from within the app, if any. */
let internalDragPath: string | null = null;
let clearTimer: number | undefined;

function normalise(path: string): string {
  return path.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

export function samePath(a: string, b: string): boolean {
  return normalise(a) === normalise(b);
}

export function isInternalDrag(path: string): boolean {
  return internalDragPath !== null && samePath(path, internalDragPath);
}

/** Builds a PNG data URL used as the drag preview shown by the OS. */
export function makeDragIcon(entry: DirEntry, imageUrl: string | undefined): string {
  if (imageUrl && imageUrl.startsWith("data:image/png")) {
    return imageUrl;
  }

  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return imageUrl ?? "";

  const radius = 14;
  ctx.beginPath();
  ctx.moveTo(6 + radius, 6);
  ctx.arcTo(size - 6, 6, size - 6, size - 6, radius);
  ctx.arcTo(size - 6, size - 6, 6, size - 6, radius);
  ctx.arcTo(6, size - 6, 6, 6, radius);
  ctx.arcTo(6, 6, size - 6, 6, radius);
  ctx.closePath();
  ctx.fillStyle = "#1b212b";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#4f8cff";
  ctx.stroke();

  ctx.fillStyle = "#e6ebf2";
  ctx.font = "bold 22px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((entry.extension ?? "?").toUpperCase().slice(0, 4), size / 2, size / 2);

  return canvas.toDataURL("image/png");
}

/**
 * Starts a native OS drag for a single entry. The same gesture drives both
 * in-app moves (handled via the window drag-drop event) and drags into other
 * applications such as slicers.
 */
export function startEntryDrag(entry: DirEntry, imageUrl?: string): void {
  internalDragPath = entry.path;
  if (clearTimer) window.clearTimeout(clearTimer);

  startDrag({
    item: [entry.path],
    icon: makeDragIcon(entry, imageUrl),
    mode: "copy",
  })
    .catch((error) => {
      console.error("Failed to start drag", error);
    })
    .finally(() => {
      clearTimer = window.setTimeout(() => {
        internalDragPath = null;
      }, 1200);
    });
}

export interface DropTarget {
  path: string;
  element: HTMLElement;
}

/** Resolves the drop target under a physical cursor position (from Tauri). */
export function dropTargetAt(
  position: { x: number; y: number },
  scale: number,
): DropTarget | null {
  const x = position.x / scale;
  const y = position.y / scale;
  const element = document.elementFromPoint(x, y) as HTMLElement | null;
  const target = element?.closest<HTMLElement>("[data-drop-path]");
  if (!target) return null;
  const path = target.dataset.dropPath;
  return path ? { path, element: target } : null;
}

let highlighted: HTMLElement | null = null;

export function highlightDropTarget(element: HTMLElement | null): void {
  if (highlighted === element) return;
  highlighted?.classList.remove("drop-hover");
  highlighted = element;
  highlighted?.classList.add("drop-hover");
}

export function clearDropHighlight(): void {
  highlightDropTarget(null);
}
