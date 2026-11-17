import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime";

import { exportPaintPass } from "./glitch-pipeline-contract";
import {
  createGlitchField,
  createSourceField,
  drawGlitchField,
  getDecodedSourceImage,
  type GlitchImageSource,
} from "./glitch-render";
import { getSourceImageAsset, readGlitchValues } from "./glitch-values";

export const glitchExportRenderer: ToolcraftProductExportRenderer = {
  baseFileName: "pixel-glitch",
  renderFrame: async ({ context, frame, rendererPipeline, signal, state }) => {
    const render = () => {
      signal.throwIfAborted();
      const values = readGlitchValues(state.values);
      let imageSource: GlitchImageSource | null = null;
      if (values.mode !== "noise") {
        const asset = getSourceImageAsset(state.mediaAssets);
        if (asset) {
          // ponytail: export reuses the preview's decoded upload; an image that
          // never reached the preview cannot be exported yet.
          const image = getDecodedSourceImage(asset.resourceRef);
          if (!image) throw new Error("The source image is still loading. Try exporting again.");
          imageSource = { image, transform: asset.transform };
        }
      }
      const source = createSourceField(values, frame, imageSource);
      if (!source) return;
      drawGlitchField(context, createGlitchField(source, values), values, frame);
    };
    if (rendererPipeline) {
      await rendererPipeline.runPass(exportPaintPass, undefined, render);
    } else {
      render();
    }
  },
};
