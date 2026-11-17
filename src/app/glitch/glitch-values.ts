import type {
  ToolcraftGradientValue,
  ToolcraftImageAsset,
  ToolcraftMediaAsset,
} from "@/toolcraft/runtime";

import {
  GLITCH_CELL_SIZE_MAX,
  GLITCH_CELL_SIZE_MIN,
  GLITCH_DEFAULT_GRADIENT,
  GLITCH_DEFAULTS,
} from "./glitch-controls";

export type GlitchValues = Readonly<{
  blocks: number;
  cellSize: number;
  depth: number;
  direction: "columns" | "rows";
  gradient: ToolcraftGradientValue;
  mode: "image" | "image-map" | "noise";
  noiseScale: number;
  scatter: number;
  seed: number;
  shift: number;
  sort: number;
  streaks: number;
}>;

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function readGradient(value: unknown): ToolcraftGradientValue {
  const candidate = value as Partial<ToolcraftGradientValue> | undefined;
  return candidate && Array.isArray(candidate.stops) && candidate.stops.length > 0
    ? {
        angle: typeof candidate.angle === "number" ? candidate.angle : GLITCH_DEFAULT_GRADIENT.angle,
        gradientType: candidate.gradientType ?? GLITCH_DEFAULT_GRADIENT.gradientType,
        stops: candidate.stops,
      }
    : { ...GLITCH_DEFAULT_GRADIENT, stops: [...GLITCH_DEFAULT_GRADIENT.stops] };
}

export function readGlitchValues(values: Readonly<Record<string, unknown>>): GlitchValues {
  return {
    blocks: readNumber(values["glitch.blocks"], GLITCH_DEFAULTS.blocks, 0, 100) / 100,
    cellSize: Math.round(
      readNumber(values["pixels.cellSize"], GLITCH_DEFAULTS.cellSize, GLITCH_CELL_SIZE_MIN, GLITCH_CELL_SIZE_MAX),
    ),
    depth: readNumber(values["color.depth"], GLITCH_DEFAULTS.depth, 0, 100) / 100,
    direction: values["glitch.direction"] === "columns" ? "columns" : "rows",
    gradient: readGradient(values["color.gradient"]),
    mode: values["source.mode"] === "image" || values["source.mode"] === "image-map" ? values["source.mode"] : "noise",
    noiseScale: readNumber(values["source.noiseScale"], GLITCH_DEFAULTS.noiseScale, 20, 600),
    scatter: readNumber(values["glitch.scatter"], GLITCH_DEFAULTS.scatter, 0, 100) / 100,
    seed: Math.round(readNumber(values["glitch.seed"], GLITCH_DEFAULTS.seed, 0, 999)),
    shift: readNumber(values["glitch.shift"], GLITCH_DEFAULTS.shift, 0, 100) / 100,
    sort: readNumber(values["glitch.sort"], GLITCH_DEFAULTS.sort, 0, 100) / 100,
    streaks: readNumber(values["glitch.streaks"], GLITCH_DEFAULTS.streaks, 0, 100) / 100,
  };
}

export function getSourceImageAsset(
  mediaAssets: readonly ToolcraftMediaAsset[],
): ToolcraftImageAsset | null {
  const asset = mediaAssets.find(
    (item): item is ToolcraftImageAsset =>
      item.assetKind === "image" &&
      item.sourceTarget === "source.image" &&
      item.lifecycle !== "unavailable",
  );
  return asset ?? null;
}
