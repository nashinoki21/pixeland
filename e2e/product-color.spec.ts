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

const sliderRows = [
  { id: "color.depth", label: "Cell depth", target: "color.depth", to: 0.95 },
] as const;

for (const row of sliderRows) {
  test(`browser: ${row.label} changes glitch pixels while dragging`, async ({ page }) => {
    await glitch.openApp(page);
    const session = await createToolcraftBrowserProofSession(page);
    await waitForGlitch(page);
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction(row.target, (control, currentPage) => dragSlider(control, currentPage, row.to)),
      { requirementId: row.id },
    );
  });
}

test("browser: Gradient parts change glitch pixels", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  const observe = observeGlitchChanged(session);
  for (const applicabilityCase of applicabilityCases("color.gradient")) {
    if (applicabilityCase.selectorValue !== "noise") {
      await chooseSegment(target(page, "source.mode"), "Image");
      if ((await target(page, "source.image").locator("img").count()) === 0) {
        await uploadTestPhoto(page);
      }
    }
    await expectToolcraftControlApplicabilityState(
      session,
      session.controlAction("source.mode", (control) =>
        chooseSegment(control, MODE_LABELS[String(applicabilityCase.selectorValue)]!),
      ),
      applicabilityCase,
      { baseRequirementId: "color.gradient" },
    );
    if (applicabilityCase.expectation !== "visible") continue;
    await waitForGlitch(page);
    const caseId = caseRequirementId("color.gradient", applicabilityCase);
    const suffix = caseId.slice("color.gradient".length);
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction("color.gradient", (control) => setStopColor(control, 3, "#00FF66")),
      { requirementId: caseId },
    );
    const parts = [
      ["gradient.angle", (control: import("@playwright/test").Locator) => setGradientAngle(control)],
      ["gradient.gradientType", (control: import("@playwright/test").Locator) => setGradientType(control)],
      ["gradient.stops.position", (control: import("@playwright/test").Locator) => setStopPosition(control, 3)],
      ["gradient.stops.color", (control: import("@playwright/test").Locator) => setStopColor(control, 2, "#FFFFFF")],
      ["gradient.stops.opacity", (control: import("@playwright/test").Locator) => setStopOpacity(control, 4)],
    ] as const;
    await ensureLinear(target(page, "color.gradient"));
    for (const [part, run] of parts) {
      await recordGlitchBaseline(page);
      await expectToolcraftCompoundControlPartOutcome(
        observe,
        session.controlAction("color.gradient", run),
        { changed: true },
        { part: `${part}${suffix}`, requirementId: "color.gradient" },
      );
    }
  }
});

