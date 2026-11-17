import type { ToolcraftImageAsset, ToolcraftSceneRect } from "@/toolcraft/runtime";

import {
  applyGlitch,
  createGradientLut,
  createLuminanceField,
  createNoiseField,
  getGridSize,
  getSubdivision,
  paintField,
  type GlitchField,
} from "./glitch-core";
import type { GlitchValues } from "./glitch-values";

export type GlitchImageSource = Readonly<{
  image: HTMLImageElement;
  transform: ToolcraftImageAsset["transform"];
}>;

const IMAGE_DEPTH_SHAPE = { angle: 135, gradientType: "linear" } as const;

/** Decoded upload bitmaps keyed by repository resource, shared by preview and export. */
const decodedImages = new Map<string, HTMLImageElement>();

export function getDecodedSourceImage(resourceRef: string): HTMLImageElement | undefined {
  return decodedImages.get(resourceRef);
}

export function decodeSourceImage(resourceRef: string, url: string): Promise<HTMLImageElement> {
  const cached = decodedImages.get(resourceRef);
  if (cached) return Promise.resolve(cached);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  return image.decode().then(() => {
    decodedImages.set(resourceRef, image);
    return image;
  });
}

export function getProductRect(size: Readonly<{ height: number; width: number }>): ToolcraftSceneRect {
  return { height: size.height, width: size.width, x: -size.width / 2, y: -size.height / 2 };
}

function createScratchContext(width: number, height: number): OffscreenCanvasRenderingContext2D {
  const context = new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Pixel glitch needs a Canvas 2D context.");
  return context;
}

/** Cover-crop the upload (with its rotate/flip transform) onto one pixel per cell. */
export function sampleImageField(source: GlitchImageSource, cols: number, rows: number): GlitchField {
  const context = createScratchContext(cols, rows);
  const rotation = source.transform?.rotationDeg ?? 0;
  const swapped = rotation % 180 !== 0;
  const shownWidth = swapped ? source.image.height : source.image.width;
  const shownHeight = swapped ? source.image.width : source.image.height;
  const scale = Math.max(cols / shownWidth, rows / shownHeight);
  context.imageSmoothingQuality = "high";
  context.translate(cols / 2, rows / 2);
  context.scale(source.transform?.flipHorizontal ? -1 : 1, source.transform?.flipVertical ? -1 : 1);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(scale, scale);
  context.drawImage(source.image, -source.image.width / 2, -source.image.height / 2);
  const pixels = context.getImageData(0, 0, cols, rows).data;
  context.canvas.width = 1;
  return createLuminanceField(pixels, cols, rows);
}

export function createSourceField(
  values: GlitchValues,
  rect: ToolcraftSceneRect,
  imageSource: GlitchImageSource | null,
): GlitchField | null {
  const { cols, rows } = getGridSize(rect.width, rect.height, values.cellSize);
  if (values.mode === "noise") {
    return createNoiseField(cols, rows, values.cellSize, values.noiseScale, values.seed);
  }
  if (!imageSource) return null;
  const field = sampleImageField(imageSource, cols, rows);
  // Image map drops the photo colors so the gradient recolors the cells.
  return values.mode === "image-map" ? { cols, rows, values: field.values } : field;
}

export function createGlitchField(source: GlitchField, values: GlitchValues): GlitchField {
  return applyGlitch(source, {
    blocks: values.blocks,
    direction: values.direction,
    scatter: values.scatter,
    seed: values.seed,
    shift: values.shift,
    sort: values.sort,
    streaks: values.streaks,
  });
}

/**
 * Draw the glitched field into `context`, whose current transform maps scene
 * coordinates to output pixels. Output is clipped to the product rect.
 */
export function drawGlitchField(
  context: CanvasRenderingContext2D,
  field: GlitchField,
  values: GlitchValues,
  rect: ToolcraftSceneRect,
): void {
  const subdivision = getSubdivision(field.cols, field.rows);
  // Photo colors have no gradient to borrow a shape from, so they get a fixed corner bevel.
  const shape = field.rgb ? IMAGE_DEPTH_SHAPE : values.gradient;
  const painted = paintField(field, createGradientLut(values.gradient), shape, values.depth, subdivision);
  const scratch = createScratchContext(painted.width, painted.height);
  scratch.putImageData(new ImageData(painted.data, painted.width, painted.height), 0, 0);
  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.imageSmoothingEnabled = false;
  context.drawImage(
    scratch.canvas,
    rect.x,
    rect.y,
    field.cols * values.cellSize,
    field.rows * values.cellSize,
  );
  context.restore();
  scratch.canvas.width = 1;
}
