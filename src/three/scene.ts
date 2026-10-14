import * as THREE from "three";

export interface Fit {
  box: THREE.Box3;
  sphere: THREE.Sphere;
  size: THREE.Vector3;
}

export const DEFAULT_VIEW_DIRECTION = new THREE.Vector3(1, 0.8, 1).normalize();

export function measureObject(object: THREE.Object3D): Fit {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const size = box.getSize(new THREE.Vector3());
  return { box, sphere, size };
}

export function frameCamera(
  camera: THREE.PerspectiveCamera,
  fit: Fit,
  direction: THREE.Vector3 = DEFAULT_VIEW_DIRECTION,
  fill = 1.35,
): void {
  const radius = Math.max(fit.sphere.radius, 1e-4);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (radius / Math.sin(fov / 2)) * fill;
  camera.position.copy(fit.sphere.center).addScaledVector(direction, distance);
  camera.near = Math.max(distance / 200, 0.001);
  camera.far = distance * 200;
  camera.updateProjectionMatrix();
  camera.lookAt(fit.sphere.center);
}

export function createLighting(): THREE.Group {
  const group = new THREE.Group();
  group.name = "lighting";

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x4a5568, 1.1);
  group.add(hemisphere);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1.2, 1.6, 1.0);
  group.add(key);

  const fill = new THREE.DirectionalLight(0xdfe7ff, 0.7);
  fill.position.set(-1.4, 0.4, -0.8);
  group.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0, -1.0, -0.6);
  group.add(rim);

  return group;
}
