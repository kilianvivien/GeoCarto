import type { CartoProject } from '@/project/cartoproj';
import { ExportError, effectiveExportSize, exportRaster, type ExportResult } from './raster';
import { translate } from '@/i18n/useLocale';

export type PdfMode = 'raster' | 'vector';

export interface PdfExportOptions {
  /** Output pixel multiplier (matches the raster scale control). Ignored in `vector` mode. */
  scale: number;
  /**
   * `raster` places a flattened PNG on the page (today's Phase 2 behavior,
   * kept as the safe fallback). `vector` reuses the SVG exporter's output —
   * which already covers every annotation/furniture kind — and converts it
   * with svg2pdf.js, producing real vector paths and selectable text. Data
   * layers still rasterize inside the SVG (basemap raster `<image>`); on a
   * projected-engine document they're real vector paths too, since the SVG
   * exporter draws those directly.
   */
  mode: PdfMode;
}

/**
 * Export a print-ready PDF. The page uses points (72 dpi) so the physical
 * size matches the frame's base (1×) pixel dimensions regardless of mode.
 */
export async function exportPdf(project: CartoProject, options: PdfExportOptions): Promise<ExportResult> {
  const { width, height } = effectiveExportSize(project, options.scale);
  if (width <= 0 || height <= 0) throw new ExportError(translate('errors.invalidDimensions'));

  const pageW = project.exportFrame.width;
  const pageH = project.exportFrame.height;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: pageW >= pageH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageW, pageH],
    compress: true,
  });

  if (options.mode === 'vector') {
    await renderVectorPdf(project, doc, pageW, pageH);
  } else {
    // Reuse the raster pipeline (white background — PDF pages are opaque).
    const raster = await exportRaster(project, {
      format: 'png',
      scale: options.scale,
      background: 'white',
      quality: 1,
    });
    const pngDataUrl = await blobToDataUrl(raster.blob);
    doc.addImage(pngDataUrl, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
  }

  const blob = doc.output('blob');
  const base = project.meta.name?.trim() || translate('common.untitled');
  return { blob, fileName: `${base.replace(/\.cartoproj$/, '')}.pdf`, width, height };
}

async function renderVectorPdf(project: CartoProject, doc: import('jspdf').jsPDF, pageW: number, pageH: number): Promise<void> {
  const { exportSvg } = await import('./svg');
  const svgResult = await exportSvg(project, { includeBasemap: true });
  const svgString = await svgResult.blob.text();
  const svgElement = new DOMParser().parseFromString(svgString, 'image/svg+xml').documentElement;

  const { svg2pdf } = await import('svg2pdf.js');
  try {
    await svg2pdf(svgElement, doc, { x: 0, y: 0, width: pageW, height: pageH });
  } catch (error) {
    throw new ExportError(translate('errors.vectorPdfFailed', { message: (error as Error).message }));
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ExportError(translate('errors.encodePdfFailed')));
    reader.readAsDataURL(blob);
  });
}
