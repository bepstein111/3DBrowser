import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.env.ROOT || "/models");
const PORT = Number(process.env.PORT || 8787);
const MODEL_EXTENSIONS = new Set([
  "stl",
  "obj",
  "3mf",
  "step",
  "stp",
  "igs",
  "iges",
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Maps a virtual ("/a/b.stl") path to a real path, rejecting traversal. */
function toReal(virtualPath) {
  const rel = (virtualPath || "/").replace(/^\/+/, "");
  const real = path.resolve(ROOT, rel);
  if (real !== ROOT && !real.startsWith(ROOT + path.sep)) {
    throw new HttpError(403, "Path is outside the allowed root");
  }
  return real;
}

function toVirtual(real) {
  const rel = path.relative(ROOT, real);
  if (rel === "") return "/";
  return "/" + rel.split(path.sep).join("/");
}

async function listDir(virtualPath) {
  const real = toReal(virtualPath);
  const dirents = await fsp.readdir(real, { withFileTypes: true });
  const entries = [];

  for (const dirent of dirents) {
    const childReal = path.join(real, dirent.name);
    let stat;
    try {
      stat = await fsp.stat(childReal);
    } catch {
      continue;
    }
    const isDir = stat.isDirectory();
    const rawExt = !isDir && path.extname(dirent.name) ? path.extname(dirent.name) : "";
    const extension = rawExt ? rawExt.slice(1).toLowerCase() : null;
    entries.push({
      name: dirent.name,
      path: toVirtual(childReal),
      isDir,
      isModel: extension !== null && MODEL_EXTENSIONS.has(extension),
      size: isDir ? 0 : stat.size,
      modifiedMs: Math.floor(stat.mtimeMs),
      extension,
    });
  }

  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  return {
    path: toVirtual(real),
    parent: real === ROOT ? null : toVirtual(path.dirname(real)),
    entries,
  };
}

function uniqueDestination(dir, fileName) {
  let candidate = path.join(dir, fileName);
  if (!fs.existsSync(candidate)) return candidate;

  const ext = path.extname(fileName);
  const stem = ext ? fileName.slice(0, -ext.length) : fileName;
  for (let n = 2; n < 10000; n += 1) {
    candidate = path.join(dir, `${stem} (${n})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return path.join(dir, fileName);
}

async function copyRecursive(source, destination) {
  const stat = await fsp.stat(source);
  if (stat.isDirectory()) {
    await fsp.mkdir(destination, { recursive: true });
    const children = await fsp.readdir(source);
    for (const child of children) {
      await copyRecursive(path.join(source, child), path.join(destination, child));
    }
  } else {
    await fsp.copyFile(source, destination);
  }
}

async function moveEntry(source, destDir) {
  const sourceReal = toReal(source);
  const destReal = toReal(destDir);

  const sourceStat = await fsp.stat(sourceReal).catch(() => null);
  if (!sourceStat) throw new HttpError(404, "Source does not exist");

  const destStat = await fsp.stat(destReal).catch(() => null);
  if (!destStat || !destStat.isDirectory()) {
    throw new HttpError(400, "Destination is not a folder");
  }

  if (path.dirname(sourceReal) === destReal) {
    return toVirtual(sourceReal);
  }
  if (destReal === sourceReal || destReal.startsWith(sourceReal + path.sep)) {
    throw new HttpError(400, "Cannot move a folder into itself");
  }

  const destination = uniqueDestination(destReal, path.basename(sourceReal));
  try {
    await fsp.rename(sourceReal, destination);
  } catch {
    await copyRecursive(sourceReal, destination);
    await fsp.rm(sourceReal, { recursive: true, force: true });
  }
  return toVirtual(destination);
}

async function copyEntries(paths, destDir) {
  const destReal = toReal(destDir);
  const destStat = await fsp.stat(destReal).catch(() => null);
  if (!destStat || !destStat.isDirectory()) {
    throw new HttpError(400, "Destination is not a folder");
  }

  const created = [];
  for (const source of paths) {
    const sourceReal = toReal(source);
    const sourceStat = await fsp.stat(sourceReal).catch(() => null);
    if (!sourceStat) continue;
    const destination = uniqueDestination(destReal, path.basename(sourceReal));
    await copyRecursive(sourceReal, destination);
    created.push(toVirtual(destination));
  }
  return created;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new HttpError(413, "Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new HttpError(400, "Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;

  if (route === "/api/health") {
    return sendJson(res, 200, { ok: true, root: toVirtual(ROOT) });
  }

  if (route === "/api/root") {
    return sendJson(res, 200, { path: "/", name: path.basename(ROOT) || ROOT });
  }

  if (route === "/api/list") {
    return sendJson(res, 200, await listDir(url.searchParams.get("path") || "/"));
  }

  if (route === "/api/file") {
    const real = toReal(url.searchParams.get("path") || "/");
    const stat = await fsp.stat(real).catch(() => null);
    if (!stat || stat.isDirectory()) throw new HttpError(404, "File not found");
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": stat.size,
    });
    fs.createReadStream(real).pipe(res);
    return undefined;
  }

  if (route === "/api/move" && req.method === "POST") {
    const body = await readJsonBody(req);
    const result = await moveEntry(String(body.source), String(body.destDir));
    return sendJson(res, 200, { path: result });
  }

  if (route === "/api/copy" && req.method === "POST") {
    const body = await readJsonBody(req);
    const result = await copyEntries(body.paths || [], String(body.destDir));
    return sendJson(res, 200, { paths: result });
  }

  throw new HttpError(404, "Not found");
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error(error);
    if (!res.headersSent) {
      sendJson(res, status, { error: error.message || "Internal error" });
    } else {
      res.end();
    }
  });
});

server.listen(PORT, () => {
  console.log(`3D Browser API listening on :${PORT}`);
  console.log(`Serving root: ${ROOT}`);
  if (!fs.existsSync(ROOT)) {
    console.warn(`Warning: root directory does not exist: ${ROOT}`);
  }
});
