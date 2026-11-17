import {
  registerToolcraftRendererPipeline,
  type ToolcraftRendererPipelinePassContract,
} from "@/toolcraft/runtime";

import type { GlitchField } from "./glitch-core";

type GlitchRendererPasses = {
  "export-paint": ToolcraftRendererPipelinePassContract<void>;
  "glitch-field": ToolcraftRendererPipelinePassContract<GlitchField>;
  "preview-paint": ToolcraftRendererPipelinePassContract<void>;
  "source-field": ToolcraftRendererPipelinePassContract<GlitchField | null>;
};

const intrinsicBounds = {
  kind: "intrinsic",
  reason:
    "The glitch is a cell grid that exactly fills the product scene rectangle; band shifts and block moves wrap inside the grid, so no output exists outside it.",
} as const;

const sourceInputs = [
  "source.mode",
  "source.image",
  "source.noiseScale",
  "pixels.cellSize",
  "glitch.seed",
  "canvas.size.width",
  "canvas.size.height",
] as const;
const glitchInputs = ["glitch.direction", "glitch.shift", "glitch.sort", "glitch.streaks", "glitch.blocks", "glitch.scatter", "glitch.seed"] as const;
const previewPasses = ["source-field", "glitch-field", "preview-paint"] as const;
const allPreviewPasses = [...previewPasses];

export const glitchRendererPipelineRegistration =
  registerToolcraftRendererPipeline<GlitchRendererPasses>()({
    interactionInvalidation: [
      { interaction: "initial-render", invalidates: allPreviewPasses, targets: ["canvas.initial-render"] },
      {
        interaction: "control-drag",
        invalidates: allPreviewPasses,
        targets: ["pixels.cellSize", "source.noiseScale", "glitch.seed"],
      },
      {
        interaction: "control-drag",
        invalidates: ["glitch-field", "preview-paint"],
        mustNotInvalidate: ["source-field"],
        targets: ["glitch.shift", "glitch.sort", "glitch.streaks", "glitch.blocks", "glitch.scatter"],
      },
      {
        interaction: "control-change",
        invalidates: ["glitch-field", "preview-paint"],
        mustNotInvalidate: ["source-field"],
        targets: ["glitch.direction"],
      },
      {
        interaction: "control-drag",
        invalidates: ["preview-paint"],
        mustNotInvalidate: ["source-field", "glitch-field"],
        targets: ["color.depth"],
      },
      {
        interaction: "control-change",
        invalidates: allPreviewPasses,
        targets: ["source.mode", "canvas.aspectRatio", "canvas.size.width", "canvas.size.height"],
      },
      {
        interaction: "control-change",
        invalidates: ["preview-paint"],
        mustNotInvalidate: ["source-field", "glitch-field"],
        targets: ["color.gradient", "canvas.renderScale"],
      },
      {
        interaction: "media-import",
        invalidates: allPreviewPasses,
        targets: ["source.image"],
      },
      {
        interaction: "export",
        invalidates: ["export-paint"],
        mustNotInvalidate: allPreviewPasses,
        targets: ["actions.output"],
      },
    ],
    passes: [
      {
        cacheKey: ["source.key"],
        cost: { dimensions: ["cell-size"], frequency: "interaction", relationship: "quadratic" },
        id: "source-field",
        inputs: [...sourceInputs],
        invalidatedBy: [...sourceInputs],
        kind: "rasterize",
        lifecycle: { cache: "memoized", resourceScope: "source" },
        output: "intermediate",
        quality: "full",
        runsOn: "main",
        sceneBounds: intrinsicBounds,
      },
      {
        cacheKey: ["glitch.key"],
        cost: { dimensions: ["cell-size"], frequency: "interaction", relationship: "quadratic" },
        id: "glitch-field",
        inputs: ["source-field", ...glitchInputs],
        invalidatedBy: ["source-field", ...glitchInputs],
        kind: "pixel-transform",
        lifecycle: { cache: "memoized", resourceScope: "interaction" },
        output: "intermediate",
        quality: "full",
        runsOn: "main",
        sceneBounds: intrinsicBounds,
      },
      {
        cost: { dimensions: ["cell-size", "preview-pixels"], frequency: "interaction", relationship: "product" },
        id: "preview-paint",
        inputs: ["glitch-field", "color.gradient", "color.depth", "canvas.backing.width", "canvas.backing.height"],
        invalidatedBy: ["glitch-field", "color.gradient", "color.depth", "canvas.backing.width", "canvas.backing.height"],
        kind: "composite",
        lifecycle: { cache: "none", resourceScope: "call" },
        output: "preview",
        quality: "retina",
        runsOn: "main",
        sceneBounds: intrinsicBounds,
      },
      {
        cost: { dimensions: ["cell-size", "export-pixels"], frequency: "batch", relationship: "product" },
        id: "export-paint",
        inputs: ["source.mode", "source.image", "color.gradient", "color.depth", ...glitchInputs, "destination.context"],
        invalidatedBy: ["source.mode", "source.image", "color.gradient", "color.depth", ...glitchInputs, "destination.context"],
        kind: "export",
        lifecycle: { cache: "none", resourceScope: "call" },
        output: "export",
        quality: "export",
        runsOn: "export-only",
      },
    ],
    runtimeId: "pixel-glitch-v1",
  });

export const sourceFieldPass = glitchRendererPipelineRegistration.getPass("source-field");
export const glitchFieldPass = glitchRendererPipelineRegistration.getPass("glitch-field");
export const previewPaintPass = glitchRendererPipelineRegistration.getPass("preview-paint");
export const exportPaintPass = glitchRendererPipelineRegistration.getPass("export-paint");
