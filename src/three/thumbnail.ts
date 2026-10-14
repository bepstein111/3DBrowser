import * as THREE from "three";
import { createLighting, frameCamera, measureObject } from "./scene";
import { disposeObject } from "./material";

/** Bump when the thumbnail look/lighting changes to invalidate cached images. */
export const THUMBNAIL_VERSION = 1;
export const THUMBNAIL_SIZE = 320;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let chain: Promise<unknown> = Promise.resolve();

function ensureRenderer(): void {
  if (renderer) return;

  const canvas = document.createElement("canvas");
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.add(createLighting());

  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
}

function renderOnce(object: THREE.Object3D): string {
  ensureRenderer();
  const activeScene = scene!;
  const activeCamera = camera!;
  const activeRenderer = renderer!;

  activeScene.add(object);
  try {
    const fit = measureObject(object);
    frameCamera(activeCamera, fit, undefined, 1.2);
    activeRenderer.render(activeScene, activeCamera);
    return activeRenderer.domElement.toDataURL("image/png");
  } finally {
    activeScene.remove(object);
    disposeObject(object);
  }
}

/**
 * Renders a PNG data URL of the given object. Jobs are serialised because they
 * share a single WebGL context, avoiding the browser's context limit.
 */
export function renderThumbnail(object: THREE.Object3D): Promise<string> {
  const task = () => renderOnce(object);
  const result = chain.then(task, task);
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
