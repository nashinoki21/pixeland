import {
  defineToolcraft,
  imageExportModule,
  mediaSourceModule,
} from "@/toolcraft/runtime";

import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";
import {
  backgroundSection,
  glitchSection,
  gradientSection,
  pixelsSection,
  sourceSection,
} from "./glitch/glitch-controls";

export const appSchema = defineToolcraft({
  defaults: appDefaults,
  base: {
    canvas: {
      enabled: true,
      renderScale: true,
      size: { height: 1350, unit: "px", width: 1080 },
      sizing: { mode: "editable-output" },
      upload: true,
    },
    identity: appIdentity,
    panels: {
      controls: {
        sections: [
          backgroundSection,
          sourceSection,
          pixelsSection,
          glitchSection,
          gradientSection,
        ],
        title: "Pixel Glitch",
      },
    },
    toolbar: {
      history: true,
      radar: true,
      theme: true,
      zoom: true,
    },
  },
  modules: [mediaSourceModule(), imageExportModule()],
});
