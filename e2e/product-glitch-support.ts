import { expect, type Locator, type Page } from "@playwright/test";

import {
  getToolcraftApplicabilityRequirementId,
  getToolcraftControlApplicabilityCases,
  type ToolcraftControlApplicabilityCase,
} from "../src/app/app-acceptance";
import { appControlSectionInventory } from "../src/app/app-acceptance-data";
import { appSchema } from "../src/app/app-schema";
import type { ToolcraftBrowserProofSession } from "./browser-proof-session";

export const GLITCH_CANVAS = 'canvas[data-pixel-glitch-canvas=""]';

export function target(page: Page, schemaTarget: string): Locator {
  return page.locator(`[data-toolcraft-control-target="${schemaTarget}"]`).first();
}

/** Wait until the glitch canvas has painted at least one opaque pixel. */
export async function waitForGlitch(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((selector) => {
          const canvas = document.querySelector<HTMLCanvasElement>(selector);
          if (!canvas || canvas.width === 0) return false;
          const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 3; i < data.length; i += 4 * 4099) if (data[i]! > 0) return true;
          return false;
        }, GLITCH_CANVAS),
      { message: "The glitch canvas should paint.", timeout: 15_000 },
    )
    .toBe(true);
}

/** Remember the current canvas pixels so observations can report whether they changed. */
export async function recordGlitchBaseline(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 4 * 61) hash = Math.imul(hash ^ data[i]! ^ (data[i + 1]! << 8) ^ (data[i + 2]! << 16) ^ (data[i + 3]! << 24), 16777619);
    (window as unknown as { __glitchBaseline: number }).__glitchBaseline = hash >>> 0;
  }, GLITCH_CANVAS);
}

/** Observation: whether the glitch pixels differ from the recorded baseline. */
export function observeGlitchChanged(session: ToolcraftBrowserProofSession) {
  return session.observe((root) => {
    const canvas = root.ownerDocument.querySelector<HTMLCanvasElement>('canvas[data-pixel-glitch-canvas=""]');
    if (!canvas || canvas.width === 0) return { changed: false };
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 4 * 61) hash = Math.imul(hash ^ data[i]! ^ (data[i + 1]! << 8) ^ (data[i + 2]! << 16) ^ (data[i + 3]! << 24), 16777619);
    const baseline = (root.ownerDocument.defaultView as unknown as { __glitchBaseline?: number }).__glitchBaseline;
    return { changed: (hash >>> 0) !== baseline };
  });
}

/** Drag a slider's thumb across part of its track with real pointer input. */
export async function dragSlider(control: Locator, page: Page, toRatio: number): Promise<void> {
  const slider = control.locator('[data-slot="slider"]').first();
  await slider.scrollIntoViewIfNeeded();
  const thumb = control.getByRole("slider").first();
  const thumbBox = await thumb.boundingBox();
  const trackBox = await slider.boundingBox();
  if (!thumbBox || !trackBox) throw new Error("Slider is not measurable.");
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.down();
  const x = trackBox.x + trackBox.width * toRatio;
  await page.mouse.move(x, thumbBox.y + thumbBox.height / 2, { steps: 8 });
  await page.mouse.up();
}

export async function chooseSegment(control: Locator, label: string): Promise<void> {
  const option = control.getByRole("radio", { name: label }).or(control.getByRole("button", { name: label })).first();
  await option.scrollIntoViewIfNeeded();
  await option.click();
}

export function applicabilityCases(schemaTarget: string): ToolcraftControlApplicabilityCase[] {
  return getToolcraftControlApplicabilityCases({
    schema: appSchema,
    sectionInventory: appControlSectionInventory,
    target: schemaTarget,
  });
}

export function caseRequirementId(baseId: string, applicabilityCase: ToolcraftControlApplicabilityCase): string {
  return getToolcraftApplicabilityRequirementId(baseId, applicabilityCase);
}

export const MODE_LABELS: Readonly<Record<string, string>> = {
  image: "Image",
  "image-map": "Image map",
  noise: "Noise",
};

/** Upload a deterministic striped test photo into the Image source. */
export async function uploadTestPhoto(page: Page, name = "stripes.png"): Promise<void> {
  const input = target(page, "source.image").locator('input[type="file"]').first();
  const png = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(240, 160);
    const context = canvas.getContext("2d")!;
    const colors = ["#E63946", "#F1FAEE", "#A8DADC", "#457B9D", "#1D3557", "#FFB703"];
    colors.forEach((color, index) => {
      context.fillStyle = color;
      context.fillRect(index * 40, 0, 40, 160);
    });
    context.fillStyle = "#000000";
    context.fillRect(0, 0, 240, 40);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await input.setInputFiles({ buffer: Buffer.from(png), mimeType: "image/png", name });
}

/** Set every gradient stop to one color (and opacity), and flatten depth, so output is a known solid color. */
export async function makeSolidGlitch(page: Page, hex: string, opacity = 100): Promise<void> {
  const gradient = target(page, "color.gradient");
  for (let stop = 1; stop <= 5; stop += 1) {
    const color = gradient.getByLabel(`Stop ${stop} hex`);
    await color.scrollIntoViewIfNeeded();
    await color.fill(hex);
    await color.press("Enter");
    const alpha = gradient.getByLabel(`Stop ${stop} opacity`);
    await alpha.fill(String(opacity));
    await alpha.press("Enter");
  }
  const depth = target(page, "color.depth").getByRole("slider");
  await depth.scrollIntoViewIfNeeded();
  await depth.focus();
  await depth.press("Home");
}

/** Click the sticky export button and return the download. */
export async function exportDownload(page: Page, label = "Export PNG") {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: label }).click();
  return download;
}

export async function selectOption(page: Page, schemaTarget: string, label: string): Promise<void> {
  const control = target(page, schemaTarget);
  await control.scrollIntoViewIfNeeded();
  await control.getByRole("combobox").first().click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

/** Pan the canvas with Space + drag, the runtime's pan gesture. */
export async function panCanvas(page: Page, dx: number, dy: number, release = true): Promise<void> {
  const viewport = page.getByRole("application", { name: "Canvas viewport" });
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Canvas viewport has no bounding box.");
  const x = box.x + box.width * 0.3;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await viewport.focus();
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  if (!release) return;
  await page.mouse.up();
  await page.keyboard.up("Space");
}

export async function releasePan(page: Page): Promise<void> {
  await page.mouse.up();
  await page.keyboard.up("Space");
}

export const BACKGROUND = "#0B0B10";
export const BACKGROUND_RGBA = [11, 11, 16, 255] as const;
// Default canvas is 1080x1350; the 4K export long edge is its height.
export const EXPORT_4K = { height: 4096, width: Math.round((1080 * 4096) / 1350) };

export async function canvasChangedSinceBaseline(page: import("@playwright/test").Page) {
  return page.evaluate((selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 4 * 61) hash = Math.imul(hash ^ data[i]! ^ (data[i + 1]! << 8) ^ (data[i + 2]! << 16) ^ (data[i + 3]! << 24), 16777619);
    return (hash >>> 0) !== (window as unknown as { __glitchBaseline: number }).__glitchBaseline;
  }, GLITCH_CANVAS);
}


// Gradient editor interactions, through the runtime gradient control's labeled fields.
type Control = Locator;

export async function setGradientType(control: Control) {
  const trigger = control.locator('[data-slot="select-trigger"]').first();
  const current = (await trigger.textContent())?.trim();
  await trigger.click();
  await control.page().getByRole("option", { name: current === "Radial" ? "Diamond" : "Radial" }).click();
}

export async function ensureLinear(control: Control) {
  const trigger = control.locator('[data-slot="select-trigger"]').first();
  if ((await trigger.textContent())?.trim() === "Linear") return;
  await trigger.click();
  await control.page().getByRole("option", { name: "Linear" }).click();
}

export async function commit(input: Control, value: string) {
  await input.scrollIntoViewIfNeeded();
  await input.fill(value);
  await input.press("Enter");
}

export async function setGradientAngle(control: Control) {
  const angle = control.getByLabel("Gradient angle");
  await commit(angle, String((Number(await angle.inputValue()) + 70) % 360));
}

export async function setStopPosition(control: Control, stop: number) {
  const input = control.getByLabel(`Stop ${stop} position`);
  const value = Number.parseFloat(await input.inputValue());
  await commit(input, String(value > 50 ? value - 15 : value + 15));
}

export async function setStopColor(control: Control, stop: number, hex: string) {
  await commit(control.getByLabel(`Stop ${stop} hex`), hex);
}

export async function setStopOpacity(control: Control, stop: number) {
  await commit(control.getByLabel(`Stop ${stop} opacity`), "35");
}

/** Open the app and wait until the runtime root is up; a cold dev server can take a while. */
export async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toHaveCount(1, { timeout: 30_000 });
  await waitForGlitch(page);
}
