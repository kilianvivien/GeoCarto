import maplibregl from 'maplibre-gl';
import { geoPath } from 'd3-geo';
import { basename, isTauri } from '@/app/platform';
import { translate } from '@/i18n/useLocale';
import { buildBasemapStyle } from '@/basemap/basemapStyle';
import { syncLayersToMap } from '@/canvas/syncLayers';
import { useMapInstance } from '@/canvas/mapInstance';
import { createMercatorProjection } from '@/canvas/canvasProjection';
import { drawProjectedScene } from '@/canvas/projectedRender';
import { buildD3Projection } from '@/projection/projections';
import { loadNaturalEarthLand } from '@/basemap/naturalEarthOutlines';
import type { CartoProject, PageBackground } from '@/project/cartoproj';
import { renderAnnotationsToCanvas } from './renderAnnotations';

export type ExportFormat = 'png' | 'jpeg';
export type ExportBackground = PageBackground;

export interface ExportOptions {
  format: ExportFormat;
  /** Output pixel multiplier on top of project.exportFrame dimensions. */
  scale: number;
  background: ExportBackground;
  /** JPEG quality in [0, 1]. Ignored for PNG. */
  quality: number;
}

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

function fillBackground(ctx: CanvasRenderingContext2D, width: number, height: number, background: ExportBackground): void {
  if (background === 'transparent') return;
  ctx.fillStyle = background === 'white' ? '#ffffff' : background;
  ctx.fillRect(0, 0, width, height);
}

async function renderMapCanvas(
  project: CartoProject,
  outW: number,
  outH: number,
): Promise<{ basemapCanvas: HTMLCanvasElement; mapAnchoredAnnotations: HTMLCanvasElement }> {
  const liveMap = useMapInstance.getState().map;
  if (!liveMap) throw new ExportError(translate('errors.mapNotReady'));
  const liveContainer = liveMap.getContainer();
  const liveW = liveContainer.clientWidth;
  const liveH = liveContainer.clientHeight;
  if (liveW === 0 || liveH === 0) throw new ExportError(translate('errors.mapNoSize'));

  const renderW = liveW;
  const renderH = liveH;
  const pixelRatio = Math.max(1, Math.min(4, outW / renderW, outH / renderH));

  const offscreen = document.createElement('div');
  offscreen.style.cssText = `position:fixed;left:-99999px;top:0;width:${renderW}px;height:${renderH}px;pointer-events:none;`;
  document.body.appendChild(offscreen);

  try {
    const map = new maplibregl.Map({
      container: offscreen,
      style: buildBasemapStyle(project.basemap),
      center: project.viewport.center,
      zoom: project.viewport.zoom,
      bearing: project.viewport.bearing,
      pitch: project.viewport.pitch,
      pixelRatio,
      interactive: false,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      fadeDuration: 0,
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (e: { error?: Error }) =>
        reject(new ExportError(e.error?.message ?? translate('errors.basemapFailed')));
      map.once('error', onError);
      map.once('load', () => {
        map.off('error', onError);
        resolve();
      });
    });

    syncLayersToMap(map, project.layers);

    // deck.gl heatmap layers render into the same WebGL context, so they're
    // captured by getCanvas() below. Lazy-import keeps deck out of this chunk.
    const { attachHeatmapOverlay } = await import('@/layers/deckHeatmap');
    const overlay = await attachHeatmapOverlay(map, project.layers);
    if (overlay) map.triggerRepaint();

    await new Promise<void>((resolve) => map.once('idle', () => resolve()));

    const sourceCanvas = map.getCanvas();
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) throw new ExportError(translate('errors.no2dContext'));
    ctx.drawImage(sourceCanvas, 0, 0, outW, outH);

    const mapAnchoredAnnotations = renderAnnotationsToCanvas({
      width: outW,
      height: outH,
      annotations: project.annotations.filter((annotation) => annotation.anchorMode === 'map'),
      map,
      projection: createMercatorProjection(map),
      frameOffset: { x: 0, y: 0 },
      scale: outW / renderW,
    });

    map.remove();
    return { basemapCanvas: out, mapAnchoredAnnotations };
  } finally {
    offscreen.remove();
  }
}

async function renderStaticBasemapCanvas(
  project: CartoProject,
  outW: number,
  outH: number,
): Promise<HTMLCanvasElement> {
  if (project.basemap.kind !== 'static') throw new ExportError(translate('errors.notStaticBasemap'));
  if (project.basemap.mediaType !== 'image') {
    throw new ExportError(translate('errors.pdfBasemapUnsupported'));
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new ExportError(translate('errors.staticImageLoad')));
    img.src = (project.basemap as { dataUrl: string }).dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ExportError(translate('errors.no2dContext'));
  // Fit the image into the output canvas preserving aspect (contain).
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const outAspect = outW / outH;
  let drawW = outW;
  let drawH = outH;
  if (imgAspect > outAspect) {
    drawH = outW / imgAspect;
  } else {
    drawW = outH * imgAspect;
  }
  ctx.drawImage(img, (outW - drawW) / 2, (outH - drawH) / 2, drawW, drawH);
  return canvas;
}

/**
 * Render a projected-engine document's land outlines + GeoJSON layers directly
 * at output resolution via `d3.geoPath` — there's no tile/raster basemap to
 * upscale (unlike Mercator's `renderMapCanvas`), so the projection is simply
 * built with a scale/center multiplied to the target pixel size.
 */
async function renderProjectedBasemapCanvas(
  project: CartoProject,
  outW: number,
  outH: number,
): Promise<HTMLCanvasElement> {
  const config = project.projection;
  if (!config) throw new ExportError(translate('errors.mapNotReady'));
  const scaleFactor = outW / project.exportFrame.width;
  const d3proj = buildD3Projection({
    ...config,
    scale: config.scale * scaleFactor,
    center: [config.center[0] * scaleFactor, config.center[1] * scaleFactor],
  });
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ExportError(translate('errors.no2dContext'));
  const path = geoPath(d3proj, ctx);
  const land = await loadNaturalEarthLand();
  drawProjectedScene(ctx, path, land, project.layers, 0.75 * scaleFactor);
  return canvas;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
}

/**
 * Render just the basemap (with imported GeoJSON baked in via the offscreen map,
 * or the fitted static image) to a canvas at the requested size. Shared by the
 * SVG exporter, which embeds this as a raster `<image>` beneath vector annotations.
 */
export async function renderBasemapCanvas(
  project: CartoProject,
  outW: number,
  outH: number,
): Promise<HTMLCanvasElement> {
  if (project.engine === 'projected') return renderProjectedBasemapCanvas(project, outW, outH);
  if (project.basemap.kind === 'static') return renderStaticBasemapCanvas(project, outW, outH);
  const { basemapCanvas } = await renderMapCanvas(project, outW, outH);
  return basemapCanvas;
}

export function effectiveExportSize(project: CartoProject, scale: number): { width: number; height: number } {
  return {
    width: Math.round(project.exportFrame.width * scale),
    height: Math.round(project.exportFrame.height * scale),
  };
}

function fileNameFor(project: CartoProject, format: ExportFormat): string {
  const ext = format === 'png' ? 'png' : 'jpg';
  const base = project.meta.name?.trim() || translate('common.untitled');
  return `${base.replace(/\.cartoproj$/, '')}.${ext}`;
}

/**
 * Render the export frame to a PNG/JPEG blob at the requested scale, compositing
 * the basemap, GeoJSON layers, and annotations.
 */
export async function exportRaster(project: CartoProject, options: ExportOptions): Promise<ExportResult> {
  const { width: outW, height: outH } = effectiveExportSize(project, options.scale);
  if (outW <= 0 || outH <= 0) throw new ExportError(translate('errors.invalidDimensions'));

  const target = document.createElement('canvas');
  target.width = outW;
  target.height = outH;
  const ctx = target.getContext('2d');
  if (!ctx) throw new ExportError(translate('errors.no2dContext'));

  fillBackground(ctx, outW, outH, options.format === 'jpeg' ? 'white' : options.background);

  const mapCanvases =
    project.engine === 'projected'
      ? { basemapCanvas: await renderProjectedBasemapCanvas(project, outW, outH), mapAnchoredAnnotations: null }
      : project.basemap.kind === 'static'
        ? {
            basemapCanvas: await renderStaticBasemapCanvas(project, outW, outH),
            mapAnchoredAnnotations: null,
          }
        : await renderMapCanvas(project, outW, outH);
  const { basemapCanvas } = mapCanvases;
  ctx.drawImage(basemapCanvas, 0, 0, outW, outH);
  if (mapCanvases.mapAnchoredAnnotations) ctx.drawImage(mapCanvases.mapAnchoredAnnotations, 0, 0);

  // Canvas-pinned annotations from the live editor stage, scaled to output coordinates.
  // Projected-engine documents have no separate high-res offscreen map step (like
  // Mercator's renderMapCanvas), so ALL annotations — geo- and canvas-anchored —
  // are positioned from the live projection here, same as the static-basemap path.
  const { map: liveMap, projection: liveProjection, containerSize: liveContainerSize } = useMapInstance.getState();
  const liveContainer = liveMap?.getContainer();
  const liveWidth = liveContainer?.clientWidth ?? liveContainerSize?.width;
  if (liveWidth) {
    const annotationCanvas = renderAnnotationsToCanvas({
      width: outW,
      height: outH,
      annotations: project.annotations.filter(
        (annotation) =>
          project.engine === 'projected' || project.basemap.kind === 'static' || annotation.anchorMode !== 'map',
      ),
      map: liveMap,
      projection: liveProjection,
      frameOffset: { x: 0, y: 0 },
      scale: outW / liveWidth,
    });
    ctx.drawImage(annotationCanvas, 0, 0);
  }

  const mime = options.format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) =>
    target.toBlob(resolve, mime, options.format === 'jpeg' ? options.quality : undefined),
  );
  if (!blob) throw new ExportError(translate('errors.encodeFailed'));

  return { blob, fileName: fileNameFor(project, options.format), width: outW, height: outH };
}

/** Last extension of a filename, lowercased and without the dot (for dialog filters). */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/**
 * Persist an exported artifact. In the browser this triggers an anchor download
 * (always "succeeds"). Under the Tauri desktop shell — where anchor downloads
 * are unreliable in WKWebView — it opens a native save dialog and writes the
 * bytes to disk. Returns `false` when the user cancels the desktop save dialog
 * (nothing written) and `true` once the file is saved / the download is started,
 * so callers can suppress the success toast on cancellation.
 */
export async function downloadBlob(blob: Blob, fileName: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const ext = extensionOf(fileName);
    const path = await save({
      defaultPath: fileName,
      filters: ext ? [{ name: basename(fileName), extensions: [ext] }] : undefined,
    });
    if (!path) return false; // User cancelled the save dialog.
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
