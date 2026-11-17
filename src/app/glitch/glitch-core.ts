import type { ToolcraftGradientValue } from "@/toolcraft/runtime";

/**
 * Cell field, row-major: brightness 0..1 per cell, plus the source RGB per
 * cell when it came from a photo.
 */
export type GlitchField = Readonly<{
  cols: number;
  rgb?: readonly number[];
  rows: number;
  values: readonly number[];
}>;

export type GlitchSettings = Readonly<{
  blocks: number;
  direction: "columns" | "rows";
  scatter: number;
  seed: number;
  shift: number;
  sort: number;
  streaks: number;
}>;

export function createRandom(seed: number): () => number {
  let state = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getGridSize(
  width: number,
  height: number,
  cellSize: number,
): Readonly<{ cols: number; rows: number }> {
  return {
    cols: Math.max(1, Math.ceil(width / cellSize)),
    rows: Math.max(1, Math.ceil(height / cellSize)),
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Fractal noise field in scene units, so the pattern stays put when cell size
 * changes. `scale` is the feature size in scene pixels.
 */
export function createNoiseField(
  cols: number,
  rows: number,
  cellSize: number,
  scale: number,
  seed: number,
): GlitchField {
  const values: number[] = new Array<number>(cols * rows).fill(0);
  const frequency = 1 / Math.max(1, scale);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = (col + 0.5) * cellSize * frequency;
      const y = (row + 0.5) * cellSize * frequency;
      let sum = 0;
      let amplitude = 0.5;
      let f = 1;
      for (let octave = 0; octave < 4; octave += 1) {
        sum += valueNoise(x * f, y * f, seed + octave * 101) * amplitude;
        f *= 2;
        amplitude *= 0.5;
      }
      values[row * cols + col] = Math.min(1, Math.max(0, (sum / 0.9375 - 0.5) * 1.6 + 0.5));
    }
  }
  return { cols, rows, values };
}

/** Rec. 709 luminance of an RGBA grid already sampled at one pixel per cell. */
export function createLuminanceField(
  rgba: Uint8ClampedArray,
  cols: number,
  rows: number,
): GlitchField {
  const values: number[] = new Array<number>(cols * rows).fill(0);
  for (let index = 0; index < cols * rows; index += 1) {
    const offset = index * 4;
    values[index] =
      (0.2126 * rgba[offset]! + 0.7152 * rgba[offset + 1]! + 0.0722 * rgba[offset + 2]!) / 255;
  }
  const rgb: number[] = [];
  for (let index = 0; index < cols * rows; index += 1) {
    rgb.push(rgba[index * 4]!, rgba[index * 4 + 1]!, rgba[index * 4 + 2]!);
  }
  return { cols, rows, rgb, values };
}

/**
 * Photo palette as gradient stops: cells sorted dark to light, split into
 * `count` equal groups, each averaged. Stops sit evenly from 0% to 100%, so the
 * gradient map keeps the photo's own tones in brightness order.
 */
export function extractPaletteStops(
  field: GlitchField,
  count: number,
): { color: string; position: string }[] {
  const rgb = field.rgb;
  if (!rgb || field.values.length === 0) return [];
  const order = Array.from(field.values.keys()).sort((a, b) => field.values[a]! - field.values[b]!);
  const stops = [];
  for (let group = 0; group < count; group += 1) {
    const start = Math.floor((group / count) * order.length);
    const end = Math.max(start + 1, Math.floor(((group + 1) / count) * order.length));
    const sum = [0, 0, 0];
    for (let i = start; i < end; i += 1) {
      for (let channel = 0; channel < 3; channel += 1) sum[channel] += rgb[order[i]! * 3 + channel]!;
    }
    const hex = sum
      .map((total) => Math.round(total / (end - start)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    stops.push({ color: `#${hex}`, position: `${Math.round((group / (count - 1)) * 100)}%` });
  }
  return stops;
}

/**
 * Deterministic glitch: band shifts, streak smears, and displaced blocks along
 * rows or columns. It moves source cells around (plus a brightness lift per
 * torn band), so photo colors travel with their cells. Everything wraps inside
 * the grid, so output never leaves the frame.
 */
export function applyGlitch(field: GlitchField, settings: GlitchSettings): GlitchField {
  const vertical = settings.direction === "columns";
  // Work in a virtual grid whose "rows" run along the glitch direction.
  const lines = vertical ? field.cols : field.rows;
  const span = vertical ? field.rows : field.cols;
  const at = (line: number, pos: number): number =>
    vertical ? pos * field.cols + line : line * field.cols + pos;
  const random = createRandom(settings.seed);
  const count = field.cols * field.rows;
  // Per output cell: which source cell it shows, and its brightness lift.
  const sources: number[] = Array.from({ length: count }, (_, index) => index);
  const lifts: number[] = new Array<number>(count).fill(0);

  if (settings.shift > 0) {
    const nextSources: number[] = new Array<number>(count).fill(0);
    const nextLifts: number[] = new Array<number>(count).fill(0);
    let line = 0;
    while (line < lines) {
      const bandSize = 1 + Math.floor(random() * Math.max(1, lines * 0.04));
      const active = random() < settings.shift;
      const offset = active ? Math.round((random() * 2 - 1) * settings.shift * span * 0.6) : 0;
      // A torn band also jumps in brightness, so it lands on another part of the gradient.
      const lift = active ? (random() * 2 - 1) * settings.shift * 0.25 : 0;
      for (let l = line; l < Math.min(lines, line + bandSize); l += 1) {
        for (let pos = 0; pos < span; pos += 1) {
          const from = at(l, (((pos - offset) % span) + span) % span);
          nextSources[at(l, pos)] = sources[from]!;
          nextLifts[at(l, pos)] = lifts[from]! + lift;
        }
      }
      line += bandSize;
    }
    for (let index = 0; index < count; index += 1) {
      sources[index] = nextSources[index]!;
      lifts[index] = nextLifts[index]!;
    }
  }

  if (settings.sort > 0) {
    // Pixel sort: runs of cells brighter than the threshold get ordered by
    // brightness along the line. More Sort lowers the threshold.
    const threshold = 1 - settings.sort * 0.85;
    const brightness = (index: number) => field.values[sources[index]!]! + lifts[index]!;
    for (let line = 0; line < lines; line += 1) {
      let pos = 0;
      while (pos < span) {
        if (brightness(at(line, pos)) < threshold) {
          pos += 1;
          continue;
        }
        let end = pos;
        while (end < span && brightness(at(line, end)) >= threshold) end += 1;
        const run: { lift: number; source: number; value: number }[] = [];
        for (let p = pos; p < end; p += 1) {
          const index = at(line, p);
          run.push({ lift: lifts[index]!, source: sources[index]!, value: brightness(index) });
        }
        run.sort((left, right) => left.value - right.value);
        for (let p = pos; p < end; p += 1) {
          sources[at(line, p)] = run[p - pos]!.source;
          lifts[at(line, p)] = run[p - pos]!.lift;
        }
        pos = end;
      }
    }
  }

  if (settings.streaks > 0) {
    const startChance = settings.streaks * 0.12;
    for (let line = 0; line < lines; line += 1) {
      let pos = 0;
      while (pos < span) {
        if (random() < startChance) {
          const length = 2 + Math.floor(random() * settings.streaks * span * 0.6);
          const from = at(line, pos);
          const end = Math.min(span, pos + length);
          for (let p = pos + 1; p < end; p += 1) {
            sources[at(line, p)] = sources[from]!;
            lifts[at(line, p)] = lifts[from]!;
          }
          pos = end;
        } else {
          pos += 1;
        }
      }
    }
  }

  const blockCount = Math.round(settings.blocks * 24);
  for (let block = 0; block < blockCount; block += 1) {
    const along = 1 + Math.floor(random() * span * 0.25);
    const across = 1 + Math.floor(random() * lines * 0.15);
    const pos0 = Math.floor(random() * span);
    const line0 = Math.floor(random() * lines);
    const dPos = Math.floor((random() * 2 - 1) * span * 0.3);
    const dLine = Math.floor((random() * 2 - 1) * lines * 0.1);
    const copySources = sources.slice();
    const copyLifts = lifts.slice();
    for (let l = 0; l < across; l += 1) {
      for (let p = 0; p < along; p += 1) {
        const tl = (line0 + l) % lines;
        const tp = (pos0 + p) % span;
        const from = at((((tl + dLine) % lines) + lines) % lines, (((tp + dPos) % span) + span) % span);
        sources[at(tl, tp)] = copySources[from]!;
        lifts[at(tl, tp)] = copyLifts[from]!;
      }
    }
  }

  // Scatter: loose bright cells, alone or in short diagonal steps, borrowed
  // from random spots in the grid.
  const scatterCount = Math.round(settings.scatter * count * 0.015);
  for (let item = 0; item < scatterCount; item += 1) {
    const length = 1 + Math.floor(random() * 3);
    const step = random() < 0.5 ? 1 : -1;
    let line = Math.floor(random() * lines);
    let pos = Math.floor(random() * span);
    const from = Math.floor(random() * count);
    for (let k = 0; k < length; k += 1) {
      const index = at(((line % lines) + lines) % lines, ((pos % span) + span) % span);
      sources[index] = from;
      lifts[index] = 0.45;
      line += 1;
      pos += step;
    }
  }

  // Read each output cell from its source cell, adding its brightness lift.
  const values: number[] = new Array<number>(count).fill(0);
  for (let index = 0; index < count; index += 1) {
    values[index] = Math.min(1, Math.max(0, field.values[sources[index]!]! + lifts[index]!));
  }
  const source = field.rgb;
  if (!source) return { cols: field.cols, rows: field.rows, values };
  const rgb: number[] = [];
  for (let index = 0; index < count; index += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = source[sources[index]! * 3 + channel]! + lifts[index]! * 255;
      rgb.push(Math.min(255, Math.max(0, Math.round(value))));
    }
  }
  return { cols: field.cols, rgb, rows: field.rows, values };
}

function parseHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  return Number.isFinite(value)
    ? [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    : [0, 0, 0];
}

/** 256-entry RGBA lookup table sampled from the gradient stops. */
export function createGradientLut(gradient: ToolcraftGradientValue): Uint8ClampedArray {
  const stops = gradient.stops
    .map((stop) => ({
      alpha: (stop.opacity ?? 100) / 100,
      position: Math.min(1, Math.max(0, Number.parseFloat(stop.position) / 100 || 0)),
      rgb: parseHex(stop.color),
    }))
    .sort((left, right) => left.position - right.position);
  const lut = new Uint8ClampedArray(256 * 4);
  if (stops.length === 0) return lut;
  for (let index = 0; index < 256; index += 1) {
    const t = index / 255;
    let upper = stops.findIndex((stop) => stop.position >= t);
    if (upper === -1) upper = stops.length - 1;
    const lower = Math.max(0, upper - 1);
    const a = stops[lower]!;
    const b = stops[upper]!;
    const span = b.position - a.position;
    const mix = span > 0 ? Math.min(1, Math.max(0, (t - a.position) / span)) : 1;
    for (let channel = 0; channel < 3; channel += 1) {
      lut[index * 4 + channel] = a.rgb[channel]! + (b.rgb[channel]! - a.rgb[channel]!) * mix;
    }
    lut[index * 4 + 3] = (a.alpha + (b.alpha - a.alpha) * mix) * 255;
  }
  return lut;
}

/**
 * Shading offset in -1..1 at a position inside one cell (u, v in 0..1). The
 * gradient's type and angle shape the per-cell depth variation.
 */
export function getCellShade(
  u: number,
  v: number,
  gradientType: ToolcraftGradientValue["gradientType"],
  angleDeg: number,
): number {
  const x = u - 0.5;
  const y = v - 0.5;
  const angle = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  switch (gradientType) {
    case "radial":
      return 1 - Math.min(1, Math.hypot(x, y) * 2 * Math.SQRT1_2) * 2;
    case "diamond":
      return 1 - Math.min(1, Math.abs(x) + Math.abs(y)) * 2;
    case "angular": {
      const turn = (Math.atan2(y, x) - angle) / (2 * Math.PI);
      return (turn - Math.floor(turn)) * 2 - 1;
    }
    default:
      return (x * dx + y * dy) * Math.SQRT2;
  }
}

/**
 * Paint the gradient-mapped field into RGBA pixels at `subdivision` pixels per
 * cell. `depth` (0..1) sets how far each cell's internal shade moves along the
 * gradient, which is what reads as depth.
 */
export function paintField(
  field: GlitchField,
  lut: Uint8ClampedArray,
  gradient: Pick<ToolcraftGradientValue, "angle" | "gradientType">,
  depth: number,
  subdivision: number,
): ImageDataLike {
  const width = field.cols * subdivision;
  const height = field.rows * subdivision;
  const data = new Uint8ClampedArray(width * height * 4);
  const shades = new Float32Array(subdivision * subdivision);
  for (let sy = 0; sy < subdivision; sy += 1) {
    for (let sx = 0; sx < subdivision; sx += 1) {
      shades[sy * subdivision + sx] =
        getCellShade((sx + 0.5) / subdivision, (sy + 0.5) / subdivision, gradient.gradientType, gradient.angle) *
        depth *
        0.5;
    }
  }
  for (let row = 0; row < field.rows; row += 1) {
    for (let col = 0; col < field.cols; col += 1) {
      const cell = row * field.cols + col;
      const value = field.values[cell]!;
      for (let sy = 0; sy < subdivision; sy += 1) {
        let offset = ((row * subdivision + sy) * width + col * subdivision) * 4;
        for (let sx = 0; sx < subdivision; sx += 1) {
          const shade = shades[sy * subdivision + sx]!;
          if (field.rgb) {
            // Photo colors: depth lightens toward white or darkens toward black.
            const toward = shade > 0 ? 255 : 0;
            const mix = Math.min(1, Math.abs(shade) * 2);
            for (let channel = 0; channel < 3; channel += 1) {
              const base = field.rgb[cell * 3 + channel]!;
              data[offset + channel] = base + (toward - base) * mix;
            }
            data[offset + 3] = 255;
            offset += 4;
            continue;
          }
          const t = value + shade;
          const lutIndex = Math.round(Math.min(1, Math.max(0, t)) * 255) * 4;
          data[offset] = lut[lutIndex]!;
          data[offset + 1] = lut[lutIndex + 1]!;
          data[offset + 2] = lut[lutIndex + 2]!;
          data[offset + 3] = lut[lutIndex + 3]!;
          offset += 4;
        }
      }
    }
  }
  return { data, height, width };
}

export type ImageDataLike = Readonly<{
  data: Uint8ClampedArray<ArrayBuffer>;
  height: number;
  width: number;
}>;

// ponytail: fixed pixel budget per paint; cells shrink their internal shading
// resolution on dense grids instead of growing the buffer.
const PAINT_PIXEL_BUDGET = 4_000_000;

export function getSubdivision(cols: number, rows: number): number {
  return Math.max(1, Math.min(8, Math.floor(Math.sqrt(PAINT_PIXEL_BUDGET / (cols * rows)))));
}
