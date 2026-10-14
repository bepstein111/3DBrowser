import { registerFormat } from "./registry";
import { applyDefaultMaterials } from "../three/material";

registerFormat({
  id: "obj",
  label: "OBJ",
  extensions: ["obj"],
  badgeColor: "#39b54a",
  async load(source) {
    const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
    const text = new TextDecoder().decode(source.data);
    const group = new OBJLoader().parse(text);
    applyDefaultMaterials(group);
    return group;
  },
});
