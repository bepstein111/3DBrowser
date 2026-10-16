# 3D Browser

A cross-platform desktop app for exploring directories of 3D printable files.
It walks the real folder structure (like a file explorer) and shows large 3D
thumbnails rendered on the fly, with a full interactive viewer for each model.

Built with **Tauri 2** (Rust backend) + **React** + **three.js**.

## Features

- Folder tree sidebar + breadcrumb navigation over the native filesystem.
- Large thumbnail grid; thumbnails are rendered in the background and cached to
  disk (keyed by path + modified time + size), so they appear instantly next time.
- Full-size viewer with orbit controls, wireframe toggle and a reset view.
- Drag a tile onto a folder (or tree node / breadcrumb) to move it, or drag it
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

The `docker` setup serves the same UI in a normal browser and reads from a
directory mounted into a container. The folder to expose is chosen with the
`MODELS_DIR` environment variable; a small Node service (proxied by Caddy,
which also serves the built frontend) provides the filesystem API.

```bash
# uses ./sample by default
docker compose up --build

# expose a folder of your own
MODELS_DIR=/path/to/models docker compose up --build   # Linux/macOS
MODELS_DIR=C:/models  docker compose up --build        # Windows (compose v2)

# then open http://localhost:8080 (override with HTTP_PORT)
```

In browser mode there is no native drag-out (a webview cannot hand a drag to
another app), but dragging a tile onto a folder still moves it via HTML5
drag-and-drop. To run the frontend and backend locally without Docker:

```bash
node server/index.mjs          # ROOT=./sample by default, PORT=8787
npm run dev                    # Vite proxies /api to the server
```

`docker-compose.yml` mounts `${MODELS_DIR:-./sample}` at `/models` and sets the
service `ROOT` to it. Point `MODELS_ROOT` at a subfolder if you want to expose
only part of the mount.

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
- `src-tauri/src/ops.rs` – move/copy operations backing drag and drop.
- `src-tauri/src/thumbs.rs` – on-disk thumbnail cache.
- `src/formats/` – format registry and loaders (the extension point).
- `src/three/` – shared scene helpers, offscreen thumbnail renderer, viewer.
- `src/lib/api.ts` – picks the desktop (Tauri) or web (HTTP) backend at runtime.
- `src/lib/dragdrop.ts` – native drag-out, drop-target hit-testing.
- `server/index.mjs` – zero-dependency HTTP file API for browser mode.
- `docker/` – Caddy config and the web/api Dockerfiles.
- `src/components/` – explorer UI (toolbar, tree, grid, viewer modal).

Drag and drop uses a single native drag gesture (via `@crabnebula/tauri-plugin-drag`).
Dropping over the window is handled by Tauri's drag-drop event, whose cursor
position is hit-tested against elements carrying a `data-drop-path` attribute;
drops outside the window are handed straight to the OS.
