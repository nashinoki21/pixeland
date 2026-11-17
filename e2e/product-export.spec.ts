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

test("browser: image formats remain selectable", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("export.image.format", (_control, currentPage) =>
      selectOption(currentPage, "export.image.format", "JPG"),
    ),
    { requirementId: "export.image-format", selector: '[data-toolcraft-control-target="export.image.format"] [data-slot="select-trigger"]' },
  );
  await expect(page.getByRole("button", { name: "Export JPG" })).toBeVisible();
  await selectOption(page, "export.image.format", "PNG");
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
});

test("browser: image resolutions remain selectable", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("export.image.resolution", (_control, currentPage) =>
      selectOption(currentPage, "export.image.resolution", "2K"),
    ),
    { requirementId: "export.image-resolution", selector: '[data-toolcraft-control-target="export.image.resolution"] [data-slot="select-trigger"]' },
  );
  await selectOption(page, "export.image.resolution", "8K");
  await selectOption(page, "export.image.resolution", "4K");
});

test("browser: image export contains the glitch", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  // The default glitch exports with varied colors across the frame.
  const glitched = await inspectToolcraftImageDownload({ backgroundRgba: BACKGROUND_RGBA, download: await exportDownload(page), page });
  expect(glitched.inspection).toMatchObject({ height: EXPORT_4K.height, mediaType: "image/png", width: EXPORT_4K.width });
  expect(new Set(Array.from(glitched.observation.normalizedPixels).join(",").match(/\d+,\d+,\d+,\d+/g)).size).toBeGreaterThan(1);

  await makeSolidGlitch(page, "#FF3366");
  await expectToolcraftImageExportArtifact(
    session.controlAction("actions.output", (_control, currentPage) => exportDownload(currentPage)),
    {
      backgroundRgba: BACKGROUND_RGBA,
      expectedBounds: { height: 1, width: 1, x: 0, y: 0 },
      expectedHeight: EXPORT_4K.height,
      expectedMediaType: "image/png",
      expectedPixels: [
        { rgba: [255, 51, 102, 255], xRatio: 0.5, yRatio: 0.5 },
        { rgba: [255, 51, 102, 255], xRatio: 0.25, yRatio: 0.75 },
      ],
      expectedWidth: EXPORT_4K.width,
      page,
      requirementId: "export.image",
    },
  );

  // JPG and the other resolutions also export real files of the selected size.
  await selectOption(page, "export.image.format", "JPG");
  await selectOption(page, "export.image.resolution", "2K");
  const jpg = await inspectToolcraftImageDownload({ backgroundRgba: BACKGROUND_RGBA, download: await exportDownload(page, "Export JPG"), page });
  expect(jpg.inspection).toMatchObject({ height: 2048, mediaType: "image/jpeg" });
});

