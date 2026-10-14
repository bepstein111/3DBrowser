import * as THREE from "three";
import { registerFormat } from "./registry";
import { createModelMaterial } from "../three/material";

registerFormat({
  id: "stl",
  label: "STL",
  extensions: ["stl"],
  badgeColor: "#4f8cff",
  async load(source) {
    const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
    const geometry = new STLLoader().parse(source.data);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, createModelMaterial());
    mesh.name = source.name;
    return mesh;
  },
});
