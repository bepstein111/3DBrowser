# 3D Browser

A cross-platform desktop app for exploring directories of 3D printable files.
It walks the real folder structure (like a file explorer) and shows large 3D
thumbnails rendered on the fly, with a full interactive viewer for each model.

Built with **Tauri 2** (Rust backend) + **React** + **three.js**.

<img width="1287" height="853" alt="2026-10-14 22_12_47-3DBrowser" src="https://github.com/user-attachments/assets/51c1aebe-4aea-49c9-8e32-bc02d8f31bf1" />


## Features

- Right-click a tile or empty space for Cut / Copy / Paste, New Folder and
  Delete (cut items are dimmed until pasted; delete asks for confirmation).
- Bookmark sidebar: save folders, rename them, drag to reorder, and click to
  jump straight there. Bookmarked folders show a filled star.
- Large thumbnail grid; thumbnails are rendered in the background and cached to
  disk (keyed by path + modified time + size), so they appear instantly next time.
- Full-size viewer with orbit controls, wireframe toggle and a reset view.
- Drag a tile onto a folder (or breadcrumb) to move it, or drag it
  out of the window into a slicer or any other application. Files dropped onto
  the app from Explorer/Finder are copied into the folder being viewed.
- Supported formats out of the box: **STL, OBJ, 3MF, STEP/STP, IGES/IGS**.

## Development

```bash
npm install
npm run tauri dev      # run the app
npm run tauri build    # produce a release bundle
```

## Running in the browser (Docker)

The same UI runs in a normal browser and reads from a directory mounted into a
container. A single Node service serves both the built frontend and the
filesystem API. The folder to expose is chosen with the `MODELS_DIR`
environment variable.

```bash
# uses ./sample by default
docker compose up --build

# expose a folder of your own
MODELS_DIR=/path/to/models docker compose up --build   # Linux/macOS
MODELS_DIR=C:/models  docker compose up --build        # Windows (compose v2)

# then open http://localhost:8080 (override with HTTP_PORT)
```

A prebuilt image is published to GitHub Container Registry on every push to
`main` and on `v*` tags:

```bash
docker run --rm -p 8080:8080 -v /path/to/models:/models \
  ghcr.io/bepstein111/3dbrowser:latest
```

`docker-compose.yml` mounts `${MODELS_DIR:-./sample}` at `/models` and sets
`ROOT` to it. Point `MODELS_ROOT` at a subfolder to expose only part of the
mount.

### Putting Caddy in front (optional)

The image has no reverse proxy; add one if you want TLS, caching or extra
headers. `docker-compose.caddy.yml` runs Caddy in front of the app:

```bash
docker compose -f docker-compose.caddy.yml up --build
# opens on http://localhost:8080, proxied through Caddy
```

Edit `docker/Caddyfile` (e.g. a real hostname for automatic HTTPS) as needed.

### Local development without Docker

```bash
node server/index.mjs          # ROOT=./sample, PORT=8787; add STATIC_DIR=./dist to serve the build
npm run dev                    # Vite proxies /api to the server
```

In browser mode there is no native drag-out (a webview cannot hand a drag to
another app), but dragging a tile onto a folder still moves it via HTML5
drag-and-drop.

## Adding a new format

Formats live in `src/formats/` and are plugged into a registry. The rest of the
app (which files count as models, badges, loading) is derived from the registry,
so adding a format touches a single new file plus one import line.

1. Create `src/formats/<name>.ts`:

   ```ts
   import * as THREE from "three";
   import { registerFormat } from "./registry";

   registerFormat({
     id: "ply",
     label: "PLY",
     extensions: ["ply"],
     badgeColor: "#14b8a6",
     async load(source) {
       const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
       const geometry = new PLYLoader().parse(source.data);
       geometry.computeVertexNormals();
       return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
     },
   });
   ```

   `source` provides `{ path, name, extension, data: ArrayBuffer }`. Heavy parsers
   should be dynamically `import()`ed inside `load` (as above) so they only load
   when needed, like the OpenCascade WASM importer used for STEP/IGES.

2. Import the file in `src/formats/index.ts` (`import "./ply";`).

Thumbnail caching is keyed by `THUMBNAIL_VERSION` in `src/three/thumbnail.ts`;
bump it after changing materials, lighting or the render size to invalidate
existing caches.

## Architecture

- `src-tauri/src/fs.rs` – filesystem listing and raw file reads.
- `src-tauri/src/ops.rs` – move/copy/create-folder operations backing the context menu and drag and drop.
- `src-tauri/src/bookmarks.rs` – bookmark persistence (JSON in the app data dir).
- `src-tauri/src/thumbs.rs` – on-disk thumbnail cache.
- `src/formats/` – format registry and loaders (the extension point).
- `src/three/` – shared scene helpers, offscreen thumbnail renderer, viewer.
- `src/lib/api.ts` – picks the desktop (Tauri) or web (HTTP) backend at runtime.
- `src/lib/dragdrop.ts` – native drag-out, drop-target hit-testing.
- `src/state/BookmarksContext.tsx` – bookmark state, persisted per backend.
- `server/index.mjs` – HTTP server that serves the built frontend and the filesystem API.
- `docker/Dockerfile` – single image (frontend build + Node server); `docker/Caddyfile` for the optional proxy.
- `.github/workflows/docker-publish.yml` – builds and publishes the image to GHCR.
- `src/components/` – explorer UI (toolbar, bookmarks panel, grid, viewer modal).

Drag and drop uses a single native drag gesture (via `@crabnebula/tauri-plugin-drag`).
Dropping over the window is handled by Tauri's drag-drop event, whose cursor
position is hit-tested against elements carrying a `data-drop-path` attribute;
drops outside the window are handed straight to the OS.
