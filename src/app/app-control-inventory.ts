import type { ToolcraftControlSectionInventoryEntry } from "./acceptance/types";

const modeRequest = {
  messageRef:
    "claude-code-session-03ad6248-01f8-453a-9633-90b6682cfdc6/ask-user-question-source",
  messageText:
    "Your refs mix glitched photos (portrait, beach, face) and fully generative patterns (stripes, mosaics). What should the pixel glitch tool work from?\"=\"Both, as modes\"",
  quote: "Both, as modes",
  source: "user-message",
} as const;

export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] = [
  {
    entity: "Output background",
    entityId: "output-background",
    finiteSelectors: [
      {
        affectedTargets: ["appearance.background"],
        reason: "Background inclusion decides whether its color fills preview and PNG output.",
        role: "branch",
        target: "export.includeBackground",
      },
    ],
    groupingReason: "Inclusion and color jointly define the fill behind the glitch.",
    id: "background",
    targets: ["export.includeBackground", "appearance.background"],
    title: "Background",
  },
  {
    entity: "Glitch source",
    entityId: "glitch-source",
    finiteSelectors: [
      {
        affectedTargets: [],
        productMode: {
          request: modeRequest,
          sharedTargets: [
            "pixels.cellSize",
            "glitch.direction",
            "glitch.seed",
            "glitch.shift",
            "glitch.sort",
            "glitch.streaks",
            "glitch.blocks",
            "glitch.scatter",
            "color.depth",
            "export.image.format",
            "export.image.resolution",
          ],
        },
        reason: "Choose the requested Image or Noise source and its own settings.",
        role: "branch",
        target: "source.mode",
      },
    ],
    groupingReason: "Mode, upload, and noise scale together decide which brightness field gets glitched.",
    id: "source",
    targets: ["source.mode", "source.image", "source.noiseScale"],
    title: "Source",
  },
  {
    entity: "Pixel grid",
    entityId: "pixel-grid",
    finiteSelectors: [],
    groupingReason: "Cell size and depth together set how big each pixel is and how much it is shaded.",
    id: "pixels",
    targets: ["pixels.cellSize", "color.depth"],
    title: "Pixels",
  },
  {
    entity: "Glitch displacement",
    entityId: "glitch-displacement",
    finiteSelectors: [
      {
        reason: "Direction changes which axis the glitch tears along without changing peer relevance.",
        role: "parameter",
        target: "glitch.direction",
      },
    ],
    groupingReason: "Direction, seed, shift, sort, streaks, blocks, and scatter are the displacement recipe applied to the grid.",
    id: "glitch",
    targets: ["glitch.direction", "glitch.seed", "glitch.shift", "glitch.sort", "glitch.streaks", "glitch.blocks", "glitch.scatter"],
    title: "Glitch",
  },
  {
    entity: "Gradient map",
    entityId: "gradient-map",
    finiteSelectors: [],
    groupingReason: "One gradient editor turns cell brightness into color and shapes the in-cell shading.",
    id: "gradient",
    targets: ["color.gradient"],
    title: "Gradient",
  },
  {
    entity: "Image delivery",
    entityId: "image-delivery",
    finiteSelectors: [
      {
        reason: "Image format changes its own exported artifact encoding.",
        role: "parameter",
        target: "export.image.format",
      },
      {
        reason: "Image resolution changes its own exported artifact dimensions.",
        role: "parameter",
        target: "export.image.resolution",
      },
    ],
    groupingReason: "Format and resolution jointly configure the exported glitch image.",
    id: "runtime.image-export",
    targets: ["export.image.format", "export.image.resolution"],
    title: "Image Export",
  },
];
