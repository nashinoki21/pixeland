import * as React from "react";
import {
  useToolcraftMediaPresentationUrls,
  useToolcraftPipeline,
  useToolcraftPipelinePass,
  useToolcraftProductSceneFrame,
  useToolcraftDispatch,
  useToolcraftSelector,
  useToolcraftValue,
} from "@/toolcraft/runtime/react";

import { extractPaletteStops } from "./glitch-core";

import {
  glitchFieldPass,
  previewPaintPass,
  sourceFieldPass,
} from "./glitch-pipeline-contract";
import {
  createGlitchField,
  createSourceField,
  decodeSourceImage,
  drawGlitchField,
  getDecodedSourceImage,
  sampleImageField,
  type GlitchImageSource,
} from "./glitch-render";
import { getSourceImageAsset, readGlitchValues } from "./glitch-values";

function useSourceImage(): GlitchImageSource | null {
  const mediaAssets = useToolcraftSelector((state) => state.mediaAssets);
  const asset = React.useMemo(() => getSourceImageAsset(mediaAssets), [mediaAssets]);
  const assetList = React.useMemo(() => (asset ? [asset] : []), [asset]);
  const urls = useToolcraftMediaPresentationUrls(assetList);
  const url = asset ? urls.get(asset.id) : undefined;
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);

  React.useEffect(() => {
    if (!asset || !url) {
      setImage(null);
      return;
    }
    const cached = getDecodedSourceImage(asset.resourceRef);
    if (cached) {
      setImage(cached);
      return;
    }
    let active = true;
    void decodeSourceImage(asset.resourceRef, url).then(
      (decoded) => active && setImage(decoded),
      () => active && setImage(null),
    );
    return () => {
      active = false;
    };
  }, [asset, url]);

  const source = React.useMemo(
    () => (asset && image ? { image, transform: asset.transform } : null),
    [asset, image],
  );
  usePhotoPaletteOnUpload(asset?.resourceRef ?? null, source);
  return source;
}

/**
 * When a new photo is uploaded (not when one is restored on reload), fill the
 * gradient stops with its palette so Image map starts from the photo's tones.
 * It is one undoable edit; Undo brings the previous stops back.
 */
function usePhotoPaletteOnUpload(resourceRef: string | null, source: GlitchImageSource | null): void {
  const dispatch = useToolcraftDispatch();
  const gradient = useToolcraftValue("color.gradient");
  const gradientRef = React.useRef(gradient);
  gradientRef.current = gradient;
  // The image present at mount was restored, not uploaded in this session.
  // Replacing an upload keeps its media id, so track the resource instead.
  const handledRef = React.useRef<string | null | undefined>(undefined);
  if (handledRef.current === undefined) handledRef.current = resourceRef;

  React.useEffect(() => {
    if (!resourceRef || !source || handledRef.current === resourceRef) return;
    // Wait until the decoded image is this resource's, not the previous upload's.
    if (getDecodedSourceImage(resourceRef) !== source.image) return;
    handledRef.current = resourceRef;
    const stops = extractPaletteStops(sampleImageField(source, 48, 48), 5);
    if (stops.length === 0) return;
    const current = readGlitchValues({ "color.gradient": gradientRef.current }).gradient;
    dispatch({
      label: "Photo palette",
      target: "color.gradient",
      type: "controls.setValue",
      value: { angle: current.angle, gradientType: current.gradientType, stops },
    });
  }, [dispatch, resourceRef, source]);
}

export function GlitchCanvas(): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const sceneFrame = useToolcraftProductSceneFrame();
  const rect = sceneFrame.kind === "ready" ? sceneFrame.rect : null;
  const rawValues = useToolcraftSelector((state) => state.values);
  const values = React.useMemo(() => readGlitchValues(rawValues), [rawValues]);
  const renderScale = useToolcraftSelector((state) => {
    const value = state.values["canvas.renderScale"];
    return typeof value === "number" && value > 0 ? value : 2;
  });
  const imageSource = useSourceImage();
  const pipeline = useToolcraftPipeline();
  const devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio;

  const sourceKey = rect
    ? JSON.stringify([
        values.mode,
        values.mode === "noise" ? values.noiseScale : null,
        values.mode === "noise" ? values.seed : null,
        values.cellSize,
        rect.width,
        rect.height,
        values.mode !== "noise" && imageSource ? imageSource.image.src : null,
        values.mode !== "noise" ? imageSource?.transform ?? null : null,
      ])
    : "empty";
  const sourceState = useToolcraftPipelinePass(sourceFieldPass, { "source.key": sourceKey }, () =>
    rect ? createSourceField(values, rect, imageSource) : null,
  );
  const sourceField = sourceState.status === "success" ? sourceState.result : null;

  const glitchKey = JSON.stringify([sourceKey, sourceField !== null, values.direction, values.seed, values.shift, values.sort, values.streaks, values.blocks, values.scatter]);
  const glitchState = useToolcraftPipelinePass(glitchFieldPass, { "glitch.key": glitchKey }, () =>
    sourceField ? createGlitchField(sourceField, values) : { cols: 0, rows: 0, values: [] },
  );
  const glitchField = glitchState.status === "success" ? glitchState.result : null;

  const backingWidth = rect ? Math.ceil(rect.width * devicePixelRatio * renderScale) : 0;
  const backingHeight = rect ? Math.ceil(rect.height * devicePixelRatio * renderScale) : 0;

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rect) return;
    const paint = () => {
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, backingWidth, backingHeight);
      if (!glitchField || glitchField.cols === 0) return;
      const scale = backingWidth / rect.width;
      context.setTransform(scale, 0, 0, backingHeight / rect.height, -rect.x * scale, -rect.y * (backingHeight / rect.height));
      drawGlitchField(context, glitchField, values, rect);
    };
    if (pipeline) void pipeline.runPass(previewPaintPass, undefined, paint);
    else paint();
  }, [backingHeight, backingWidth, glitchField, pipeline, rect, values]);

  return (
    <canvas
      data-pixel-glitch-canvas=""
      data-toolcraft-product-output=""
      ref={canvasRef}
      style={{
        display: "block",
        height: rect ? `${rect.height}px` : 0,
        width: rect ? `${rect.width}px` : 0,
      }}
    />
  );
}
