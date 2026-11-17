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
  { id: "pixels.cell-size", label: "Cell size", target: "pixels.cellSize", to: 0.7 },
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

