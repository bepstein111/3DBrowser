import type { Object3D } from "three";

export interface ModelSource {
  path: string;
  name: string;
  extension: string;
  data: ArrayBuffer;
}

export interface ModelFormat {
  /** Stable identifier, e.g. "stl". */
  id: string;
  /** Human readable label shown in the UI, e.g. "STL". */
  label: string;
  /** Lowercase extensions (without dot) handled by this format. */
  extensions: string[];
  /** Accent colour used for the format badge. */
  badgeColor: string;
  /** Parse the raw file bytes into a three.js object hierarchy. */
  load(source: ModelSource): Promise<Object3D>;
}
