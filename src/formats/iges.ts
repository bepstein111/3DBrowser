import { registerFormat } from "./registry";
import { createOcctFormat } from "./occt";

registerFormat(
  createOcctFormat({
    id: "iges",
    label: "IGES",
    extensions: ["iges", "igs"],
    badgeColor: "#ec4899",
    reader: "iges",
  }),
);
