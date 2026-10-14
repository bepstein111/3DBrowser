import { registerFormat } from "./registry";
import { applyDefaultMaterials } from "../three/material";

registerFormat({
  id: "3mf",
  label: "3MF",
  extensions: ["3mf"],
  badgeColor: "#a855f7",
  async load(source) {
    const { ThreeMFLoader } = await import("three/addons/loaders/3MFLoader.js");
    const group = new ThreeMFLoader().parse(source.data);
    applyDefaultMaterials(group);
    return group;
  },
});
