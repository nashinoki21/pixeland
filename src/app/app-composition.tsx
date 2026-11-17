import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { GlitchCanvas } from "./glitch/glitch-canvas";
import { glitchExportRenderer } from "./glitch/glitch-export";
import { glitchRendererPipelineRegistration } from "./glitch/glitch-pipeline-contract";
import { getProductRect } from "./glitch/glitch-render";

export const appComposition = composeToolcraftApp(appSchema, {
  renderer: { pipelineRegistration: glitchRendererPipelineRegistration },
  scene: {
    canvasContent: <GlitchCanvas />,
    rasterFrameRenderer: glitchExportRenderer,
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: ({ state }) => [getProductRect(state.canvas.size)],
  },
});
