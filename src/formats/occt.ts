import * as THREE from "three";
import type { ModelFormat, ModelSource } from "./types";
import { createModelMaterial } from "../three/material";

interface OcctMeshData {
  name?: string;
  color?: number[];
  attributes: {
    position: { array: number[] };
    normal?: { array: number[] };
  };
  index?: { array: number[] };
}

interface OcctResult {
  success: boolean;
  meshes?: OcctMeshData[];
}

interface OcctModule {
  ReadStepFile(data: Uint8Array, params: unknown): OcctResult;
  ReadIgesFile(data: Uint8Array, params: unknown): OcctResult;
}

let occtPromise: Promise<OcctModule> | null = null;

function getOcct(): Promise<OcctModule> {
  if (!occtPromise) {
    occtPromise = (async () => {
      const [mod, wasmModule] = await Promise.all([
        import("occt-import-js"),
        import("occt-import-js/dist/occt-import-js.wasm?url"),
      ]);
      const factory = (mod.default ?? mod) as unknown as (config?: {
        locateFile?: (path: string) => string;
      }) => Promise<OcctModule>;
      return factory({ locateFile: () => wasmModule.default });
    })();
  }
  return occtPromise;
}

function toObject3D(result: OcctResult, name: string): THREE.Object3D {
  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error("The CAD importer returned no geometry.");
  }
  const group = new THREE.Group();
  group.name = name;
  for (const mesh of result.meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3),
    );
    if (mesh.attributes.normal) {
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3),
      );
    } else {
      geometry.computeVertexNormals();
    }
    if (mesh.index) {
      geometry.setIndex(new THREE.Uint32BufferAttribute(mesh.index.array, 1));
    }
    const material = createModelMaterial();
    if (mesh.color) material.color.fromArray(mesh.color);
    const child = new THREE.Mesh(geometry, material);
    if (mesh.name) child.name = mesh.name;
    group.add(child);
  }
  return group;
}

export interface OcctFormatOptions {
  id: string;
  label: string;
  extensions: string[];
  badgeColor: string;
  reader: "step" | "iges";
}

/** Builds a ModelFormat backed by the OpenCascade (occt-import-js) WASM module. */
export function createOcctFormat(options: OcctFormatOptions): ModelFormat {
  return {
    id: options.id,
    label: options.label,
    extensions: options.extensions,
    badgeColor: options.badgeColor,
    async load(source: ModelSource) {
      const occt = await getOcct();
      const bytes = new Uint8Array(source.data);
      const result =
        options.reader === "step"
          ? occt.ReadStepFile(bytes, null)
          : occt.ReadIgesFile(bytes, null);
      return toObject3D(result, source.name);
    },
  };
}
