import {
  defineToolcraftPerformance,
  type ToolcraftEnvelopePerformanceConfig,
} from "@/toolcraft/runtime";

import { glitchRendererPipelineRegistration } from "./glitch/glitch-pipeline-contract";
import {
  createGlitchPerformanceScenarios,
  deriveGlitchPerformancePaths,
  glitchFixtureAdapters,
  glitchWorkloadEnvelope,
} from "./glitch/glitch-workload";

export { glitchRendererPipelineRegistration as appRendererPipelineRegistration } from "./glitch/glitch-pipeline-contract";

const basePerformance = defineToolcraftPerformance({
  fixtureAdapters: glitchFixtureAdapters,
  rendererPipeline: glitchRendererPipelineRegistration,
  rendererStrategy: "canvas-2d",
  rendererTechnique: {
    exportRenderer: "canvas-2d",
    fidelityRisks: [
      "Export rebuilds the glitch from the same values and seed, and must match the preview cell for cell.",
    ],
    intentionalRasterizationReason:
      "The product is a pixel grid: each cell is a raster sample of a noise field or photo.",
    layers: [
      {
        content: ["dense-pattern", "noise", "bitmap-media"],
        exportMode: "included",
        id: "glitchGrid",
        kind: "product-foreground",
        primitiveCount: "high",
        renderer: "canvas-2d",
        uiSelector: 'canvas[data-pixel-glitch-canvas=""]',
      },
    ],
    performanceRisks: [
      "Small cells on large canvases multiply sampled, glitched, and painted cells.",
    ],
    previewRenderer: "canvas-2d",
    productRepresentation: "pixel",
    rendererStrategy: "canvas-2d",
    sourceRepresentation: "procedural-data",
    whyNotAlternativeStrategies: [
      "WebGL would add a shader pipeline for a grid that is at most a few hundred thousand cells per frame.",
      "SVG would need one element per cell and cannot keep up with small cell sizes.",
    ],
  },
  scenarios: [],
  usesCustomRenderer: true,
  workloadEnvelope: glitchWorkloadEnvelope,
} satisfies ToolcraftEnvelopePerformanceConfig);

export const appPerformance = defineToolcraftPerformance({
  ...basePerformance,
  scenarios: createGlitchPerformanceScenarios(basePerformance),
});

export const appPerformancePaths = deriveGlitchPerformancePaths(appPerformance);
