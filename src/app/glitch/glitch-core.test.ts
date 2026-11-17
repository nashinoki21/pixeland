import { describe, expect, it } from "vitest";

import {
  applyGlitch,
  createGradientLut,
  createNoiseField,
  extractPaletteStops,
  getCellShade,
  getGridSize,
  paintField,
} from "./glitch-core";

const gradient = {
  angle: 90,
  gradientType: "linear" as const,
  stops: [
    { color: "#000000", position: "0%" },
    { color: "#FFFFFF", position: "100%" },
  ],
};

describe("pixel glitch core", () => {
  it("sizes the grid by rounding cells up to cover the frame", () => {
    expect(getGridSize(1080, 1350, 16)).toEqual({ cols: 68, rows: 85 });
  });

  it("is deterministic per seed and stays inside 0..1", () => {
    const field = createNoiseField(40, 30, 16, 200, 3);
    const settings = { blocks: 0.5, direction: "rows" as const, scatter: 0.5, seed: 11, shift: 0.6, sort: 0.5, streaks: 0.5 };
    const a = applyGlitch(field, settings);
    const b = applyGlitch(field, settings);
    expect(Array.from(a.values)).toEqual(Array.from(b.values));
    expect(Array.from(a.values).every((v) => v >= 0 && v <= 1)).toBe(true);
    const other = applyGlitch(field, { ...settings, seed: 12 });
    expect(Array.from(other.values)).not.toEqual(Array.from(a.values));
  });

  it("leaves the field untouched when every glitch amount is zero", () => {
    const field = createNoiseField(20, 10, 8, 50, 1);
    const result = applyGlitch(field, { blocks: 0, direction: "rows" as const, scatter: 0, seed: 5, shift: 0, sort: 0, streaks: 0 });
    expect(Array.from(result.values)).toEqual(Array.from(field.values));
  });

  it("moves photo colors with their cells and tears columns in column mode", () => {
    // 4x4 grid where each column has its own color: a row tear mixes columns
    // inside a row, a column tear never does.
    const cols = 4;
    const rows = 4;
    const rgb: number[] = new Array<number>(cols * rows * 3).fill(0);
    for (let i = 0; i < cols * rows; i += 1) rgb[i * 3] = (i % cols) * 60;
    const field = { cols, rgb, rows, values: new Array<number>(cols * rows).fill(0.5) };
    const settings = { blocks: 0, scatter: 0, seed: 3, shift: 0, sort: 0, streaks: 1 };
    const columns = applyGlitch(field, { ...settings, direction: "columns" });
    for (let i = 0; i < cols * rows; i += 1) expect(columns.rgb![i * 3]).toBe((i % cols) * 60);
    const rowsResult = applyGlitch(field, { ...settings, direction: "rows" });
    expect(Array.from(rowsResult.rgb!)).not.toEqual(Array.from(rgb));
  });

  it("pixel-sorts bright runs from dark to light along the row", () => {
    const values = [0.9, 0.95, 0.92, 0.1, 0.99, 0.91];
    const field = { cols: 6, rows: 1, values };
    const sorted = applyGlitch(field, {
      blocks: 0, direction: "rows", scatter: 0, seed: 1, shift: 0, sort: 0.2, streaks: 0,
    });
    expect(Array.from(sorted.values)).toEqual([0.9, 0.92, 0.95, 0.1, 0.91, 0.99]);
  });

  it("extracts a dark-to-light palette from photo colors", () => {
    const rgb = [200, 0, 0, 10, 10, 10, 250, 250, 250];
    const field = { cols: 3, rgb, rows: 1, values: [0.5, 0.04, 0.98] };
    expect(extractPaletteStops(field, 3)).toEqual([
      { color: "#0A0A0A", position: "0%" },
      { color: "#C80000", position: "50%" },
      { color: "#FAFAFA", position: "100%" },
    ]);
  });

  it("maps brightness through the gradient", () => {
    const lut = createGradientLut(gradient);
    expect(Array.from(lut.slice(0, 4))).toEqual([0, 0, 0, 255]);
    expect(Array.from(lut.slice(255 * 4, 256 * 4))).toEqual([255, 255, 255, 255]);
  });

  it("shades inside a cell along the gradient angle only when depth is on", () => {
    expect(getCellShade(1, 0.5, "linear", 90)).toBeGreaterThan(0);
    expect(getCellShade(0, 0.5, "linear", 90)).toBeLessThan(0);
    expect(getCellShade(0.5, 0.5, "radial", 0)).toBeCloseTo(1);

    const field = { cols: 1, rows: 1, values: [0.5] };
    const lut = createGradientLut(gradient);
    const flat = paintField(field, lut, gradient, 0, 4);
    const deep = paintField(field, lut, gradient, 1, 4);
    expect(new Set(Array.from(flat.data)).size).toBeLessThanOrEqual(2);
    const left = deep.data[(1 * 4 + 0) * 4]!;
    const right = deep.data[(1 * 4 + 3) * 4]!;
    expect(right).toBeGreaterThan(left);
  });
});
