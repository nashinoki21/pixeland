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

test("browser: Mode switches the glitch source", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  await expectToolcraftSegmentedControlCellsPreservePadding(page, "Mode", {
    requirementId: "source.mode",
    target: "source.mode",
  });
  // Give the image modes a photo so every option renders its own source.
  await chooseSegment(target(page, "source.mode"), "Image");
  await uploadTestPhoto(page);
  await waitForGlitch(page);
  await chooseSegment(target(page, "source.mode"), "Noise");
  await waitForGlitch(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("source.mode", (control) => chooseSegment(control, "Image")),
    { requirementId: "source.mode" },
  );
  await chooseSegment(target(page, "source.mode"), "Image map");
  await waitForGlitch(page);
  await chooseSegment(target(page, "source.mode"), "Noise");
  await expect(target(page, "source.noiseScale")).toBeVisible();
});

test("browser: Scale changes glitch pixels while dragging", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  for (const applicabilityCase of applicabilityCases("source.noiseScale")) {
    await expectToolcraftControlApplicabilityState(
      session,
      session.controlAction("source.mode", (control) =>
        chooseSegment(control, MODE_LABELS[String(applicabilityCase.selectorValue)]!),
      ),
      applicabilityCase,
      { baseRequirementId: "source.noise-scale" },
    );
    if (applicabilityCase.expectation === "visible") {
      await waitForGlitch(page);
      await expectToolcraftProductObservableToChange(
        session,
        session.controlAction("source.noiseScale", (control, currentPage) => dragSlider(control, currentPage, 0.9)),
        { requirementId: caseRequirementId("source.noise-scale", applicabilityCase) },
      );
    }
  }
});

test("browser: Image upload, transform, remove, and reset", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  const observeMedia = session.observe((root) => {
    const doc = root.ownerDocument;
    const items = [...doc.querySelectorAll<HTMLImageElement>('[data-toolcraft-control-target="source.image"] img')].map(
      (image) => image.alt,
    );
    const canvas = doc.querySelector<HTMLCanvasElement>('canvas[data-pixel-glitch-canvas=""]');
    let painted = false;
    if (canvas && canvas.width > 0) {
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4 * 4099) if (data[i]! > 0) painted = true;
    }
    return { itemIds: items, outputSignature: painted ? "glitched photo" : "empty canvas" };
  });

  for (const applicabilityCase of applicabilityCases("source.image")) {
    await expectToolcraftControlApplicabilityState(
      session,
      session.controlAction("source.mode", (control) =>
        chooseSegment(control, MODE_LABELS[String(applicabilityCase.selectorValue)]!),
      ),
      applicabilityCase,
      { baseRequirementId: "source.image" },
    );
    if (applicabilityCase.expectation !== "visible") continue;
    const name = `stripes-${String(applicabilityCase.selectorValue)}.png`;
    await expectToolcraftMediaLifecycle(
      observeMedia,
      session.controlAction("source.image", (_control, currentPage) => uploadTestPhoto(currentPage, name)),
      { itemIds: [name], outputSignature: "glitched photo" },
      { requirementId: caseRequirementId("source.image", applicabilityCase) },
    );
    await waitForGlitch(page);

    // Rotate and flip change the sampled photo, so the glitch output changes.
    for (const label of ["90° Right", "Flip horizontal", "Flip vertical"]) {
      await recordGlitchBaseline(page);
      await target(page, "source.image").getByRole("button", { name: label }).click();
      await expect.poll(() => canvasChangedSinceBaseline(page)).toBe(true);
    }

    // Remove clears the source and the canvas.
    await target(page, "source.image").getByRole("button", { name: `Remove ${name}` }).click();
    await expect(target(page, "source.image").locator("img")).toHaveCount(0);
    await expect.poll(() => session && page.evaluate((selector) => {
      const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      return data.some((value, index) => index % 4 === 3 && value > 0);
    }, GLITCH_CANVAS)).toBe(false);
  }

  // Section reset removes an uploaded photo (there is no default photo).
  await chooseSegment(target(page, "source.mode"), "Image");
  await uploadTestPhoto(page, "reset.png");
  await expect(target(page, "source.image").locator("img")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset Source section" }).click();
  await chooseSegment(target(page, "source.mode"), "Image");
  await expect(target(page, "source.image").locator("img")).toHaveCount(0);
});

