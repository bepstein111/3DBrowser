import * as THREE from "three";

export const DEFAULT_MODEL_COLOR = 0xb9c0cc;

export function createModelMaterial(color: number = DEFAULT_MODEL_COLOR): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.15,
    roughness: 0.6,
  });
}

/** Give every mesh a usable material and normals so it renders reliably. */
export function applyDefaultMaterials(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    if (!mesh.material) mesh.material = createModelMaterial();
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (geometry && !geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }
  });
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value && (value as THREE.Texture).isTexture) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
}
