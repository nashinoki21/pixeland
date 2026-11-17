# Implementation Worklog

## Status

Mode: product

Active change: pixel-glitch-delivery-1

## Decisions

### Renderer
- Decision: Canvas 2D on the main thread. A memoized `source-field` pass builds one brightness value (and, for photos, one RGB color) per cell; a memoized `glitch-field` pass applies the seeded shift/sort/streak/block/scatter recipe as a cell permutation plus a brightness lift; an uncached `preview-paint` pass gradient-maps the cells with in-cell depth shading into a staging bitmap drawn with smoothing off. Export runs the same three steps in one `export-paint` pass.
- Reason: The grid is at most a few hundred thousand cells, so CPU work stays interactive without a shader pipeline, and preview and export share the exact same pure functions in `src/app/glitch/glitch-core.ts`.
- Evidence: src/app/glitch/glitch-core.ts, glitch-render.ts, glitch-canvas.tsx, glitch-export.ts, glitch-pipeline-contract.ts, app-performance.ts.

### View Interaction
- Decision: non-spatial.
- Reason: The glitch is a flat raster with no model or camera.
- Evidence: appProductReadiness.viewInteraction.

### Interaction Ownership
- Decision: The panel owns source mode, cell size, the glitch recipe, and the gradient; the canvas owns runtime viewport panning.
- Reason: Every product setting is a global, non-spatial value; panning is the only spatial operation.
- Evidence: appProductReadiness.interactionOwnership linked to acceptance rows source.mode, pixels.cell-size, glitch.shift, color.gradient, canvas.viewport.

### Timeline
- Decision: No timeline.
- Reason: The user chose still output with PNG export; nothing animates.
- Evidence: appTransferMode.animationIntent is `none`.

### Layers
- Decision: No layers.
- Reason: The user did not request a layer workflow; there is one source image at most.
- Evidence: appSchema.panels.layers is omitted.

### Controls
- Decision: Built-in segmented, fileDrop, slider, and gradient controls in Background, Source, Pixels, Glitch, and Gradient sections. Source mode (Noise / Image / Image map) is the explicit product mode; the gradient applies to Noise and Image map, Image keeps the photo's colors.
- Reason: Each value has an exact built-in owner; the gradient is its own section because the runtime gives the compound editor its own section.
- Evidence: src/app/glitch/glitch-controls.ts and src/app/app-control-inventory.ts.

### Export
- Decision: Default image export only (PNG/JPG at 2K/4K/8K).
- Reason: The user chose "Still + PNG export"; SVG and video were not requested.
- Evidence: appProductReadiness.exportIntent and `scene.rasterFrameRenderer`.

### Performance
- Decision: Workload dimensions are cell size (smaller is heavier), preview backing pixels, export long edge, and derived export pixels. No measured performance was run.
- Reason: Cell count drives sampling, glitching, and painting; backing and export size drive the paint.
- Evidence: src/app/glitch/glitch-workload.ts; render-plan assessment passes in app-performance.gates.test.ts.

## Decision Trail

### Delivery 1 - Pixel glitch tool
- Change ID: pixel-glitch-delivery-1
- Request: "Now, I want to create a tool to product pixelated glitch with gradient variation for depth. I added a folder `refs`inside pixeland for visual reference."
- Task type: First product delivery: schema, custom Canvas 2D renderer, media upload, image export.
- User-visible result: A pixel glitch generator with Noise, Image, and Image map sources; seeded shift, sort, streak, block, and scatter glitches along rows or columns; a gradient map whose type and angle shade each cell for depth; PNG/JPG export.
- Source/reference checked: 25 still images in `refs/` (glitched photos, pixel sorting, gradient pixel posters, block mosaics).
- Reference inputs: None (still images only; no video, GIF, or frame sequence).
- Docs/contracts read: workflow.md, core/runtime-boundary.md, assembly-workflow.md, core/control-selection.md, core/layout.md, core/performance.md, core/setup-export.md, core/media-upload.md, schema-reference.md, component-rules.md, renderer-technique.md, performance.md, decision-contract.md, acceptance-testing.md, core/app-cover.md.
- Contract rules applied: runtime-shell-required, canvas-no-app-ui, infinity-canvas-scene-bounds, controls-section-inventory-required, output-export-required, renderer-technique-inventory, acceptance-product-observable, persistence-policy-explicit.
- View interaction intent: non-spatial; the output is a flat raster.
- Interaction ownership: Panel owns all product settings; canvas owns viewport pan.
- Decision: Canvas 2D cell renderer with shared pure glitch functions; explicit Noise / Image / Image map product mode from the user's answer "Both, as modes"; photo palette fills the gradient on each new upload as one undoable edit.
- Alternatives rejected: WebGL (unneeded for this cell count); a separate image-gradient on/off switch (applicability has no OR, so the gradient could not show in both Noise and gradient-mapped Image); scattering cells outside the frame (would need content-bounds overflow proof).
- State/output mapping: source.* and pixels.cellSize feed `source-field`; glitch.* feed `glitch-field`; color.gradient and color.depth feed `preview-paint`; the same values feed `export-paint` through `scene.rasterFrameRenderer`; canvas.size defines the product rect in both canvas modes.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` runs the protected functional proof; no measured performance.
- Risks: Risk: Export reuses the preview's decoded upload, so exporting before a new upload finishes decoding reports a retryable error. Risk: Two pre-existing framework typecheck errors in `src/toolcraft/runtime/react/timeline` (motion/csstype mismatch) are outside product ownership.

## Evidence

- App cover: `public/toolcraft/cover.png` is the app's own PNG export (2048x1152) of the default Noise glitch on a 16:9 1920x1080 canvas at 2K; settings in `app-cover-state.json`, metadata in `app-cover.json`. Checked visually against the live preview.
- Browser proof: `e2e/product-glitch.spec.ts` and `e2e/product-glitch-output.spec.ts` (22 tests) plus the generic reload spec pass locally with no unmet runtime evidence.
- Source reviewed: refs/ images, local Toolcraft docs, the e2e/fixtures/vgpu-physical-feedback example product.
- Contract applied: product decisions above.

## Verification

Protected receipts own initial proof.

## Risks

- Risk: The photo palette averages brightness bands, so it can look muted on saturated photos.
