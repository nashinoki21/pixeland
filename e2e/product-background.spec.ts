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

test("browser: Background inclusion controls output", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  // A fully transparent gradient leaves only the runtime background visible.
  await makeSolidGlitch(page, "#FF3366", 0);

  const observePreview = session.observe((root) => {
    const layer = root.ownerDocument.querySelector<HTMLElement>("[data-toolcraft-finite-background-layer]");
    const visible = layer !== null && getComputedStyle(layer).display !== "none" && getComputedStyle(layer).visibility !== "hidden";
    return {
      backgroundVisible: visible,
      outputSignature: visible ? `background ${getComputedStyle(layer!).backgroundColor}` : "transparent",
    };
  });
  const includeSwitch = (control: import("@playwright/test").Locator) => control.getByRole("switch").click();

  await expectToolcraftBackgroundOutputSemantics(
    observePreview,
    session.controlAction("export.includeBackground", includeSwitch),
    { backgroundVisible: false, outputSignature: "transparent" },
    session.controlAction("actions.output", (_control, currentPage) => exportDownload(currentPage)),
    async (download) => {
      const { inspection, observation } = await inspectToolcraftImageDownload({
        backgroundRgba: [0, 0, 0, 0],
        download,
        page,
      });
      return { ...inspection, backgroundAlpha: observation.normalizedPixels[3]! };
    },
    { requirementId: "background.include" },
  );

  const observeStacking = session.observe((root) => {
    const doc = root.ownerDocument;
    const layer = doc.querySelector<HTMLElement>("[data-toolcraft-finite-background-layer]");
    const product = doc.querySelector<HTMLElement>("[data-toolcraft-product-scene]");
    const canvas = doc.querySelector<HTMLCanvasElement>('canvas[data-pixel-glitch-canvas=""]');
    const surface = doc.querySelector<HTMLElement>("[data-toolcraft-canvas-mode]");
    const visible = layer !== null && getComputedStyle(layer).display !== "none";
    const order = [
      ...(layer ? [{ element: layer, name: "background" }] : []),
      ...(product ? [{ element: product, name: "product" }] : []),
    ].sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    const color = layer ? getComputedStyle(layer).backgroundColor : "";
    return {
      backgroundColor: color || "none",
      backgroundVisible: visible,
      canvasMode: (surface?.dataset.toolcraftCanvasMode ?? "finite") as "finite" | "infinite",
      layerOrder: order.map(({ name }) => name),
      mediaVisible: false,
      outputSignature: visible ? `background ${color}` : "transparent",
      productForegroundTransparent: canvas ? getComputedStyle(canvas).backgroundColor === "rgba(0, 0, 0, 0)" : false,
    };
  });
  await expectToolcraftFiniteBackgroundMediaStacking(
    observeStacking,
    session.controlAction("export.includeBackground", includeSwitch),
    {
      backgroundColor: "rgb(11, 11, 16)",
      backgroundVisible: true,
      canvasMode: "finite",
      layerOrder: ["background", "product"],
      mediaVisible: false,
      outputSignature: "background rgb(11, 11, 16)",
      productForegroundTransparent: true,
    },
    { requirementId: "background.include" },
  );

  await target(page, "canvas.infinity").getByRole("switch").click();
  const infinite = await observeInfinityCanvasBackground(page);
  await target(page, "export.includeBackground").getByRole("switch").click();
  const backgroundExcluded = await observeInfinityCanvasBackground(page);
  await target(page, "export.includeBackground").getByRole("switch").click();
  const backgroundRestored = await observeInfinityCanvasBackground(page);
  await expectToolcraftInfinityCanvasBackgroundEvidence(
    { backgroundExcluded, backgroundRestored, infinite },
    { expectedBackgroundColor: BACKGROUND, requirementId: "background.include", target: "export.includeBackground" },
  );
});

test("browser: Background color reaches export", async ({ page }) => {
  await glitch.openApp(page);
  const session = await createToolcraftBrowserProofSession(page);
  await waitForGlitch(page);
  await makeSolidGlitch(page, "#FF3366", 0);
  for (const applicabilityCase of applicabilityCases("appearance.background")) {
    await expectToolcraftControlApplicabilityState(
      session,
      session.controlAction("export.includeBackground", async (control) => {
        const toggle = control.getByRole("switch");
        const checked = (await toggle.getAttribute("aria-checked")) === "true";
        if (checked !== applicabilityCase.selectorValue) await toggle.click();
      }),
      applicabilityCase,
      { baseRequirementId: "background.color" },
    );
    await expectToolcraftExportedArtifact(
      session.controlAction("appearance.background", async (control, currentPage) => {
        const color = control.getByRole("textbox");
        await color.fill("#203040");
        await color.press("Enter");
        return exportDownload(currentPage);
      }),
      async (download) => {
        const { inspection, observation } = await inspectToolcraftImageDownload({
          backgroundRgba: [32, 48, 64, 255],
          download,
          page,
        });
        const corner = Array.from(observation.normalizedPixels.slice(0, 4));
        expect(corner).toEqual(applicabilityCase.selectorValue ? [32, 48, 64, 255] : [0, 0, 0, 0]);
        return inspection;
      },
      { requirementId: caseRequirementId("background.color", applicabilityCase) },
    );
  }
});

