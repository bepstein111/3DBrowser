import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createLighting, frameCamera, measureObject, type Fit } from "./scene";
import { disposeObject } from "./material";

export interface ViewerStats {
  meshes: number;
  triangles: number;
  vertices: number;
}

/** Interactive three.js viewport used by the full-size model viewer. */
export class ModelViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private container: HTMLElement;
  private object: THREE.Object3D | null = null;
  private grid: THREE.GridHelper | null = null;
  private fit: Fit | null = null;
  private animation = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private wireframe = false;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = "viewer-canvas";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.add(createLighting());

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
    this.camera.position.set(3, 2, 3);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.9;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  setObject(object: THREE.Object3D): ViewerStats {
    this.clearObject();

    this.object = object;
    this.applyWireframe();
    this.scene.add(object);

    this.fit = measureObject(object);
    const radius = Math.max(this.fit.sphere.radius, 1e-3);
    const grid = new THREE.GridHelper(radius * 6, 24, 0x6d7c93, 0x3a465b);
    grid.position.set(
      this.fit.sphere.center.x,
      this.fit.box.min.y,
      this.fit.sphere.center.z,
    );
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.45;
    this.scene.add(grid);
    this.grid = grid;

    this.resetView();
    return computeStats(object);
  }

  resetView(): void {
    if (!this.object || !this.fit) return;
    frameCamera(this.camera, this.fit, undefined, 1.25);
    this.controls.target.copy(this.fit.sphere.center);
    this.controls.update();
  }

  setWireframe(enabled: boolean): void {
    this.wireframe = enabled;
    this.applyWireframe();
  }

  private applyWireframe(): void {
    this.object?.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (material && "wireframe" in material) {
          (material as THREE.MeshStandardMaterial).wireframe = this.wireframe;
        }
      }
    });
  }

  private clearObject(): void {
    if (this.object) {
      this.scene.remove(this.object);
      disposeObject(this.object);
      this.object = null;
    }
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
      this.grid = null;
    }
  }

  private resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.animation = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animation);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearObject();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function computeStats(object: THREE.Object3D): ViewerStats {
  let meshes = 0;
  let triangles = 0;
  let vertices = 0;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    meshes += 1;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geometry) return;
    const position = geometry.attributes.position;
    if (position) vertices += position.count;
    if (geometry.index) triangles += geometry.index.count / 3;
    else if (position) triangles += position.count / 3;
  });
  return { meshes, triangles: Math.round(triangles), vertices };
}
