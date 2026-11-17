import {
  defineToolcraftDiscreteFixtureAdapter,
  defineToolcraftFixtureAdapter,
  deriveToolcraftPerformancePaths,
  type ToolcraftEnvelopePerformanceConfig,
  type ToolcraftPerformanceScenario,
} from "@/toolcraft/runtime";

import { appSchema } from "../app-schema";
import { GLITCH_CELL_SIZE_MIN, GLITCH_DEFAULTS } from "./glitch-controls";

export const GLITCH_MAX_INTERACTIVE_PREVIEW_PIXELS = 44_736_000;
export const GLITCH_DEFAULT_PREVIEW_PIXELS = 23_328_000; // 1080x1350 at DPR 2 and scale 2

// Exported pixel counts for the default 1080x1350 (4:5) canvas: the long edge is
// the selected resolution and the short edge scales with it.
export const GLITCH_EXPORT_PIXELS = {
  "2k": 2_048 * 1_638,
  "4k": 4_096 * 3_277,
  "8k": 8_192 * 6_554,
} as const;

export type GlitchPreviewPixelFixture = Readonly<{
  backingHeight: number;
  backingWidth: number;
  canvasHeight: number;
  canvasWidth: number;
  renderScale: 2;
}>;

function createPreviewPixelFixture(value: number): GlitchPreviewPixelFixture {
  const whole = Math.round(value);
  if (!Number.isSafeInteger(whole) || Math.abs(whole - value) > 0.000_001 || whole <= 0) {
    throw new Error(`Preview pixels must be a positive whole count, received ${value}.`);
  }
  for (let backingWidth = 8_192; backingWidth >= 2; backingWidth -= 2) {
    const backingHeight = whole / backingWidth;
    if (Number.isSafeInteger(backingHeight) && backingHeight >= 2 && backingHeight <= 8_192 && backingHeight % 2 === 0) {
      return { backingHeight, backingWidth, canvasHeight: backingHeight / 2, canvasWidth: backingWidth / 2, renderScale: 2 };
    }
  }
  throw new Error(`Preview pixel count ${value} has no exact render-scale-2 canvas fixture.`);
}

export const glitchFixtureAdapters = {
  dimensions: {
    "cell-size": defineToolcraftFixtureAdapter<number>({
      apply: (value) => Math.round(value),
      dimensionId: "cell-size",
      observe: (value) => value,
    }),
    "export-long-edge": defineToolcraftDiscreteFixtureAdapter({
      dimensionId: "export-long-edge",
      domain: {
        kind: "schema-options",
        optionValues: ["2k", "4k", "8k"],
        target: "export.image.resolution",
      },
      entries: [
        { appliedValue: "2k", value: 2_048 },
        { appliedValue: "4k", value: 4_096 },
        { appliedValue: "8k", value: 8_192 },
      ],
    }),
    "export-pixels": defineToolcraftDiscreteFixtureAdapter({
      dimensionId: "export-pixels",
      domain: {
        attestation:
          "The three resolution options on the default 4:5 canvas exhaust the exported pixel counts the performance fixture reaches.",
        inputs: ["export-long-edge"],
        kind: "derived",
      },
      entries: [
        { appliedValue: "2k", value: GLITCH_EXPORT_PIXELS["2k"] },
        { appliedValue: "4k", value: GLITCH_EXPORT_PIXELS["4k"] },
        { appliedValue: "8k", value: GLITCH_EXPORT_PIXELS["8k"] },
      ],
    }),
    "preview-pixels": defineToolcraftFixtureAdapter<GlitchPreviewPixelFixture>({
      apply: createPreviewPixelFixture,
      dimensionId: "preview-pixels",
      observe: ({ backingHeight, backingWidth }) => backingHeight * backingWidth,
    }),
  },
};

export const glitchWorkloadEnvelope = {
  dimensions: [
    {
      batchMax: GLITCH_CELL_SIZE_MIN,
      defaultValue: GLITCH_DEFAULTS.cellSize,
      id: "cell-size",
      interactiveMax: GLITCH_CELL_SIZE_MIN,
      mapping: "direct",
      source: { kind: "schema-target", target: "pixels.cellSize", workloadBoundary: "minimum" },
      unit: "pixels",
    },
    {
      batchMax: GLITCH_MAX_INTERACTIVE_PREVIEW_PIXELS,
      defaultValue: GLITCH_DEFAULT_PREVIEW_PIXELS,
      id: "preview-pixels",
      interactiveMax: GLITCH_MAX_INTERACTIVE_PREVIEW_PIXELS,
      mapping: "direct",
      source: { kind: "runtime-state", path: "canvas.backingPixelsAtSelectedRenderScale" },
      unit: "pixels",
    },
    {
      batchMax: 8_192,
      customMappingReason: "The image resolution option maps to its exact numeric long edge.",
      defaultValue: 4_096,
      id: "export-long-edge",
      mapping: "custom",
      source: { kind: "schema-target", target: "export.image.resolution" },
      unit: "pixels",
    },
    {
      batchMax: GLITCH_EXPORT_PIXELS["8k"],
      defaultValue: GLITCH_EXPORT_PIXELS["4k"],
      id: "export-pixels",
      mapping: "direct",
      source: { inputs: ["export-long-edge"], kind: "derived" },
      unit: "pixels",
    },
  ],
} satisfies ToolcraftEnvelopePerformanceConfig["workloadEnvelope"];

export function deriveGlitchPerformancePaths(performance: ToolcraftEnvelopePerformanceConfig) {
  return deriveToolcraftPerformancePaths(appSchema, performance);
}

const controlLabels: Readonly<Record<string, string>> = {
  "color.depth": "Depth",
  "glitch.blocks": "Blocks",
  "glitch.scatter": "Scatter",
  "glitch.seed": "Seed",
  "glitch.shift": "Shift",
  "glitch.sort": "Sort",
  "glitch.streaks": "Streaks",
  "pixels.cellSize": "Cell size",
  "source.noiseScale": "Scale",
};

export function createGlitchPerformanceScenarios(
  performance: ToolcraftEnvelopePerformanceConfig,
): ToolcraftPerformanceScenario[] {
  return deriveGlitchPerformancePaths(performance).map((path): ToolcraftPerformanceScenario => {
    const common = {
      automated: true,
      automatedTestName: `perf: glitch ${path.id}`,
      browser: true,
      browserTestName: `browser perf: glitch ${path.id}`,
      coversTargets: path.targets,
      expectedObservable: `The ${path.interaction} path repaints the glitch at full quality.`,
      fixture: "default noise glitch",
      id: `glitch-${path.id}`,
      pathId: path.id,
      ...(path.targets.length === 1 ? { target: path.targets[0] } : {}),
    };
    if (path.interaction === "export") {
      return {
        ...common,
        actionValue: "export.png",
        completionEvidence: "download",
        controlLabel: "Export PNG",
        interaction: "export",
      };
    }
    const label = path.targets.map((target) => controlLabels[target]).find(Boolean);
    return {
      ...common,
      ...(path.interaction === "control-drag" && label
        ? { controlLabel: label }
        : path.targets[0]
          ? { uiSelector: `[data-toolcraft-control-target="${path.targets[0]}"]` }
          : {}),
      interaction: path.interaction,
    };
  });
}
