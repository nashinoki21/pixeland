import { expectToolcraftExportedArtifact } from "./browser-acceptance-outcome-helpers";
import {
  expectToolcraftBackgroundOutputSemantics,
  expectToolcraftFiniteBackgroundMediaStacking,
} from "./browser-background-output-evidence";
import { expectToolcraftControlApplicabilityState } from "./browser-control-applicability-evidence";
import {
  expectToolcraftInfinityCanvasBackgroundEvidence,
  expectToolcraftInfinityCanvasImageExportEvidence,
  expectToolcraftInfinityCanvasModeEvidence,
  observeInfinityCanvas,
  observeInfinityCanvasBackground,
} from "./browser-infinity-canvas-evidence";
import { expectToolcraftImageExportArtifact } from "./browser-media-export-evidence";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { expectToolcraftCanvasRenderScaleEvidence } from "./browser-render-scale-evidence";
import {
  expectToolcraftCompoundControlPartOutcome,
  expectToolcraftMediaLifecycle,
  expectToolcraftViewportSideEffect,
} from "./browser-state-evidence-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import {
  expectToolcraftDiscreteSliderMarkers,
  expectToolcraftSegmentedControlCellsPreservePadding,
} from "./performance-control-layout-helpers";
import * as glitch from "./product-glitch-support";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";

const { applicabilityCases, caseRequirementId, chooseSegment, dragSlider, MODE_LABELS, observeGlitchChanged, recordGlitchBaseline, target, uploadTestPhoto, waitForGlitch, exportDownload, GLITCH_CANVAS, makeSolidGlitch, panCanvas, releasePan, selectOption, BACKGROUND, BACKGROUND_RGBA, EXPORT_4K, canvasChangedSinceBaseline, ensureLinear, setGradientType, setGradientAngle, setStopPosition, setStopColor, setStopOpacity } = glitch;

test("browser: glitch canvas backing follows render scale", async ({ page }) => {
  await glitch.openApp(page);
  await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  await expectToolcraftDiscreteSliderMarkers(page, "canvas.renderScale", "canvas.render-scale");
  await expectToolcraftCanvasRenderScaleEvidence(page, {
    canvasSelector: GLITCH_CANVAS,
    requirementId: "canvas.render-scale",
    selectedScale: 2,
    stateTransitions: [
      { run: async () => waitForGlitch(page), state: "steady" },
      { run: async () => panCanvas(page, 60, 30, false), state: "interaction" },
    ],
    target: "canvas.renderScale",
  });
  await releasePan(page);
});

test("browser: Infinity keeps the glitch frame", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  const captureIdentity = () =>
    page.evaluateHandle(() => ({
      host: document.querySelector("[data-toolcraft-product-scene]"),
      output: document.querySelector("[data-toolcraft-product-output]"),
    }));
  const compare = (identity: Awaited<ReturnType<typeof captureIdentity>>) =>
    page.evaluate(
      (baseline) => ({
        productHostPreserved: baseline.host !== null && baseline.host === document.querySelector("[data-toolcraft-product-scene]"),
        productOutputPreserved: baseline.output !== null && baseline.output === document.querySelector("[data-toolcraft-product-output]"),
      }),
      identity,
    );
  const infinity = () => target(page, "canvas.infinity").getByRole("switch").click();

  const before = await observeInfinityCanvas(page);
  const initial = await captureIdentity();
  await infinity();
  await waitForGlitch(page);
  const enabled = await observeInfinityCanvas(page);
  const beforeToEnabled = await compare(initial);
  await panCanvas(page, 50, 20);
  const afterPan = await observeInfinityCanvas(page);
  await page.reload();
  await waitForGlitch(page);
  const afterReload = await observeInfinityCanvas(page);
  const restoredIdentity = await captureIdentity();
  await infinity();
  await waitForGlitch(page);
  const restored = await observeInfinityCanvas(page);
  const afterReloadToRestored = await compare(restoredIdentity);
  await page.getByRole("button", { name: "Undo" }).click();
  const undone = await observeInfinityCanvas(page);
  const restoredToUndone = await compare(restoredIdentity);
  await page.getByRole("button", { name: "Redo" }).click();
  const redone = await observeInfinityCanvas(page);
  const undoneToRedone = await compare(restoredIdentity);

  await expectToolcraftInfinityCanvasModeEvidence(
    { afterPan, afterReload, before, enabled, redone, restored, undone },
    { afterReloadToRestored, beforeToEnabled, restoredToUndone, undoneToRedone },
    {
      expectedFiniteSize: { height: 1350, width: 1080 },
      expectedSceneRect: before.productScene.worldRect!,
      requirementId: "canvas.infinity-mode",
      target: "canvas.infinity",
    },
  );
  void session;
});

test("browser: Infinity export keeps the glitch frame", async ({ page }) => {
  await glitch.openApp(page);
  await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  const finite = await inspectToolcraftImageDownload({ backgroundRgba: BACKGROUND_RGBA, download: await exportDownload(page), page });
  await target(page, "canvas.infinity").getByRole("switch").click();
  await waitForGlitch(page);
  const infinite = await inspectToolcraftImageDownload({ backgroundRgba: BACKGROUND_RGBA, download: await exportDownload(page), page });
  await expectToolcraftInfinityCanvasImageExportEvidence(
    { finite: finite.inspection, infinite: infinite.inspection },
    { expectedSize: EXPORT_4K, requirementId: "canvas.infinity-export", target: "canvas.infinity" },
  );
});

test("browser: canvas pan moves the glitch view", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  const observeViewport = session.observe((root) => {
    const doc = root.ownerDocument;
    const world = doc.querySelector<HTMLElement>("[data-toolcraft-canvas-world]")!;
    const canvas = doc.querySelector<HTMLCanvasElement>('canvas[data-pixel-glitch-canvas=""]')!;
    return {
      offsetX: Number(world.dataset.toolcraftCanvasOffsetX),
      offsetY: Number(world.dataset.toolcraftCanvasOffsetY),
      outputHeight: canvas.height,
      outputWidth: canvas.width,
      zoom: Number(world.dataset.toolcraftCanvasZoom),
    };
  });
  const before = await observeInfinityCanvas(page);
  void before;
  const start = await page.evaluate(() => {
    const world = document.querySelector<HTMLElement>("[data-toolcraft-canvas-world]")!;
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-pixel-glitch-canvas=""]')!;
    return {
      offsetX: Number(world.dataset.toolcraftCanvasOffsetX),
      offsetY: Number(world.dataset.toolcraftCanvasOffsetY),
      outputHeight: canvas.height,
      outputWidth: canvas.width,
      zoom: Number(world.dataset.toolcraftCanvasZoom),
    };
  });
  await expectToolcraftViewportSideEffect(
    observeViewport,
    session.targetAction("canvas.setOffset", (currentPage) => panCanvas(currentPage, 80, 40)),
    { ...start, offsetX: start.offsetX + 80, offsetY: start.offsetY + 40 },
    { requirementId: "canvas.viewport" },
  );
});

