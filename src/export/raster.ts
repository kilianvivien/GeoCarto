import maplibregl from 'maplibre-gl';
import { buildBasemapStyle } from '@/basemap/basemapStyle';
import { syncLayersToMap } from '@/canvas/syncLayers';
import { useMapInstance } from '@/canvas/mapInstance';
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
  if (!liveMap) throw new ExportError('Map is not ready.');
  const liveContainer = liveMap.getContainer();
  const liveW = liveContainer.clientWidth;
  const liveH = liveContainer.clientHeight;
  if (liveW === 0 || liveH === 0) throw new ExportError('Map container has no size.');

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
      const onError = (e: { error?: Error }) => reject(new ExportError(e.error?.message ?? 'Basemap failed to load'));
      map.once('error', onError);
      map.once('load', () => {
        map.off('error', onError);
        resolve();
      });
    });

    syncLayersToMap(map, project.layers);

    await new Promise<void>((resolve) => map.once('idle', () => resolve()));

    const sourceCanvas = map.getCanvas();
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) throw new ExportError('Could not allocate 2D context.');
    ctx.drawImage(sourceCanvas, 0, 0, outW, outH);

    const mapAnchoredAnnotations = renderAnnotationsToCanvas({
      width: outW,
      height: outH,
      annotations: project.annotations.filter((annotation) => annotation.anchorMode === 'map'),
      map,
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
  if (project.basemap.kind !== 'static') throw new ExportError('Not a static basemap.');
  if (project.basemap.mediaType !== 'image') {
    throw new ExportError('Export of PDF basemaps is not supported yet.');
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new ExportError('Could not load static basemap image.'));
    img.src = (project.basemap as { dataUrl: string }).dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ExportError('Could not allocate 2D context.');
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
  const base = project.meta.name?.trim() || 'Untitled';
  return `${base.replace(/\.cartoproj$/, '')}.${ext}`;
}

/**
 * Render the export frame to a PNG/JPEG blob at the requested scale, compositing
 * the basemap, GeoJSON layers, and annotations.
 */
export async function exportRaster(project: CartoProject, options: ExportOptions): Promise<ExportResult> {
  const { width: outW, height: outH } = effectiveExportSize(project, options.scale);
  if (outW <= 0 || outH <= 0) throw new ExportError('Invalid output dimensions.');

  const target = document.createElement('canvas');
  target.width = outW;
  target.height = outH;
  const ctx = target.getContext('2d');
  if (!ctx) throw new ExportError('Could not allocate 2D context.');

  fillBackground(ctx, outW, outH, options.format === 'jpeg' ? 'white' : options.background);

  const mapCanvases =
    project.basemap.kind === 'static'
      ? {
          basemapCanvas: await renderStaticBasemapCanvas(project, outW, outH),
          mapAnchoredAnnotations: null,
        }
      : await renderMapCanvas(project, outW, outH);
  const { basemapCanvas } = mapCanvases;
  ctx.drawImage(basemapCanvas, 0, 0, outW, outH);
  if (mapCanvases.mapAnchoredAnnotations) ctx.drawImage(mapCanvases.mapAnchoredAnnotations, 0, 0);

  // Canvas-pinned annotations from the live editor stage, scaled to output coordinates.
  const liveMap = useMapInstance.getState().map;
  const liveContainer = liveMap?.getContainer();
  if (liveContainer) {
    const annotationCanvas = renderAnnotationsToCanvas({
      width: outW,
      height: outH,
      annotations: project.annotations.filter(
        (annotation) => project.basemap.kind === 'static' || annotation.anchorMode !== 'map',
      ),
      map: liveMap,
      frameOffset: { x: 0, y: 0 },
      scale: outW / liveContainer.clientWidth,
    });
    ctx.drawImage(annotationCanvas, 0, 0);
  }

  const mime = options.format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) =>
    target.toBlob(resolve, mime, options.format === 'jpeg' ? options.quality : undefined),
  );
  if (!blob) throw new ExportError('Failed to encode output image.');

  return { blob, fileName: fileNameFor(project, options.format), width: outW, height: outH };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
