import { registerFormat } from "./registry";
import { createOcctFormat } from "./occt";

registerFormat(
  createOcctFormat({
    id: "step",
    label: "STEP",
    extensions: ["step", "stp"],
    badgeColor: "#f59e0b",
    reader: "step",
  }),
);
