import { describe, expect, it } from "vitest";

import {
  appAcceptance,
  validateProductAcceptanceCoverage,
} from "./app-acceptance";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";
import {
  createGradientLut,
  getSubdivision,
  paintField,
  type GlitchField,
} from "./glitch/glitch-core";
import { GLITCH_DEFAULT_GRADIENT } from "./glitch/glitch-controls";
import { createGlitchField, createSourceField, getProductRect } from "./glitch/glitch-render";
import { readGlitchValues } from "./glitch/glitch-values";

const rect = getProductRect({ height: 270, width: 216 });

function control(target: string) {
  return appSchema.panels.controls?.sections
    .flatMap((section) => Object.values(section.controls))
    .find((candidate) => candidate.target === target);
}

/** Render the noise glitch for the given raw control values into RGBA bytes. */
function render(overrides: Record<string, unknown> = {}): Uint8ClampedArray {
  const values = readGlitchValues(overrides);
  const source = createSourceField(values, rect, null);
  if (!source) throw new Error("Noise mode always produces a source field.");
  const field = createGlitchField(source, values);
  const subdivision = getSubdivision(field.cols, field.rows);
  return paintField(field, createGradientLut(values.gradient), values.gradient, values.depth, subdivision).data;
}

function expectChanged(target: string, from: unknown, to: unknown) {
  expect(Array.from(render({ [target]: to }))).not.toEqual(Array.from(render({ [target]: from })));
}

describe("pixel glitch schema", () => {
  it("assembles the glitch product with image export and media upload", () => {
    expect(appSchema.canvas.sizing).toEqual({ mode: "editable-output" });
    expect(appSchema.modulePlan.modules.map(({ id }) => id).sort()).toEqual(["image-export", "media-source"]);
    expect(appSchema.panels.layers).toBeUndefined();
    expect(appSchema.panels.timeline).toBeUndefined();
    expect(appPerformance.usesCustomRenderer).toBe(true);
  });

  it("declares production reload coverage for the glitch schema", () => {
    expect(appSchema.persistence.storage).toBe("localStorage");
    if (appSchema.persistence.storage !== "localStorage") throw new Error("Glitch must persist locally.");
    expect(appSchema.persistence.include).toEqual(expect.arrayContaining(["canvas", "media", "values"]));
    expect(appAcceptance.find(({ id }) => id === "persistence.reload")).toMatchObject({
      persistenceCoverage: "reload",
      persistenceSlices: appSchema.persistence.include,
    });
    expect(validateProductAcceptanceCoverage()).toEqual([]);
  });

  it("Mode selects the noise, image, and image map sources", () => {
    expect(control("source.mode")).toMatchObject({ defaultValue: "noise", type: "segmented" });
    expect(control("source.noiseScale")?.applicability).toMatchObject({
      all: [{ oneOf: ["noise"], target: "source.mode" }],
    });
    expect(control("color.gradient")?.applicability).toMatchObject({
      all: [{ oneOf: ["noise", "image-map"], target: "source.mode" }],
    });
    // Image modes without an upload render nothing instead of placeholder art.
    expect(createSourceField(readGlitchValues({ "source.mode": "image" }), rect, null)).toBeNull();
    expect(readGlitchValues({ "source.mode": "image-map" }).mode).toBe("image-map");
  });

  it("Image upload feeds the image source", () => {
    expect(control("source.image")).toMatchObject({ assetKind: "image", target: "source.image", type: "fileDrop" });
    expect(control("source.image")?.applicability).toMatchObject({
      all: [{ oneOf: ["image", "image-map"], target: "source.mode" }],
    });
  });

  it("Scale reaches the glitch renderer", () => expectChanged("source.noiseScale", 100, 400));
  it("Cell size reaches the glitch renderer", () => expectChanged("pixels.cellSize", 8, 24));
  it("Seed reaches the glitch renderer", () => expectChanged("glitch.seed", 1, 2));
  it("Shift reaches the glitch renderer", () => expectChanged("glitch.shift", 0, 90));
  it("Sort reaches the glitch renderer", () => expectChanged("glitch.sort", 0, 90));
  it("Streaks reaches the glitch renderer", () => expectChanged("glitch.streaks", 0, 90));
  it("Blocks reaches the glitch renderer", () => expectChanged("glitch.blocks", 0, 90));
  it("Scatter reaches the glitch renderer", () => expectChanged("glitch.scatter", 0, 90));
  it("Cell depth reaches the glitch renderer", () => expectChanged("color.depth", 0, 100));

  it("Direction tears along rows or columns", () => {
    expectChanged("glitch.direction", "rows", "columns");
  });

  it("Gradient recolors and shades the cells", () => {
    const base = { ...GLITCH_DEFAULT_GRADIENT, stops: [...GLITCH_DEFAULT_GRADIENT.stops] };
    const deep = { "color.depth": 100 };
    const variants = [
      { ...base, gradientType: "radial" },
      { ...base, angle: 20 },
      { ...base, stops: base.stops.map((stop, i) => (i === 2 ? { ...stop, position: "40%" } : stop)) },
      { ...base, stops: base.stops.map((stop, i) => (i === 2 ? { ...stop, color: "#00FF00" } : stop)) },
      { ...base, stops: base.stops.map((stop, i) => (i === 2 ? { ...stop, opacity: 20 } : stop)) },
    ];
    const baseline = Array.from(render({ ...deep, "color.gradient": base }));
    for (const gradient of variants) {
      expect(Array.from(render({ ...deep, "color.gradient": gradient }))).not.toEqual(baseline);
    }
  });

  it("background inclusion controls preview and PNG transparency", () => {
    // The glitch foreground never paints a background; runtime owns that fill.
    const transparent = {
      ...GLITCH_DEFAULT_GRADIENT,
      stops: GLITCH_DEFAULT_GRADIENT.stops.map((stop) => ({ ...stop, opacity: 0 })),
    };
    const pixels = render({ "color.gradient": transparent });
    expect(pixels.every((value, index) => index % 4 !== 3 || value === 0)).toBe(true);
    expect(control("export.includeBackground")).toMatchObject({ defaultValue: true, type: "switch" });
  });

  it("background color reaches export", () => {
    expect(control("appearance.background")).toMatchObject({ defaultValue: "#0B0B10", type: "color" });
  });

  it("image format options remain selectable", () => {
    expect(control("export.image.format")).toMatchObject({ defaultValue: "png", type: "select" });
  });

  it("image resolution options remain selectable", () => {
    expect(control("export.image.resolution")).toMatchObject({ defaultValue: "4k", type: "select" });
  });

  it("glitch export matches the preview recipe", () => {
    // Preview and export share createSourceField/createGlitchField, so equal values give equal cells.
    const values = readGlitchValues({ "glitch.seed": 42 });
    const a = createGlitchField(createSourceField(values, rect, null)!, values);
    const b = createGlitchField(createSourceField(values, rect, null)!, values);
    expect(Array.from(a.values)).toEqual(Array.from(b.values));
  });

  it("glitch canvas uses selected backing pixels", () => {
    expect(appSchema.canvas.renderScale).toMatchObject({ enabled: true, max: 2, min: 1 });
  });

  it("glitch keeps its frame across Infinity", () => {
    // The product rect comes from canvas size alone, never from the Infinity mode.
    expect(getProductRect({ height: 1350, width: 1080 })).toEqual({ height: 1350, width: 1080, x: -540, y: -675 });
  });

  it("glitch export keeps the artboard across Infinity", () => {
    const field: GlitchField = createSourceField(readGlitchValues({}), rect, null)!;
    expect(field.cols * readGlitchValues({}).cellSize).toBeGreaterThanOrEqual(rect.width);
    expect(field.rows * readGlitchValues({}).cellSize).toBeGreaterThanOrEqual(rect.height);
  });

  it("glitch canvas pans without repainting", () => {
    const pan = appPerformance.rendererPipeline?.interactionInvalidation.filter(
      ({ interaction }) => interaction === "viewport-drag",
    );
    expect(pan ?? []).toEqual([]);
  });
});
