import type { CartoProject } from '@/project/cartoproj';
import { ExportError, effectiveExportSize, exportRaster, type ExportResult } from './raster';

export interface PdfExportOptions {
  /** Output pixel multiplier (matches the raster scale control). */
  scale: number;
}

/**
 * Export a print-ready PDF. Phase 2 ships raster-in-PDF: the existing high-DPI
 * PNG is placed on a single page sized to the composition frame's aspect (the
 * editable-vector PDF path is deferred to Post-v1 per the plan). The page uses
 * points (72 dpi) so the physical size matches the frame's pixel dimensions.
 */
export async function exportPdf(project: CartoProject, options: PdfExportOptions): Promise<ExportResult> {
  const { width, height } = effectiveExportSize(project, options.scale);
  if (width <= 0 || height <= 0) throw new ExportError('Invalid output dimensions.');

  // Reuse the raster pipeline (white background — PDF pages are opaque).
  const raster = await exportRaster(project, {
    format: 'png',
    scale: options.scale,
    background: 'white',
    quality: 1,
  });
  const pngDataUrl = await blobToDataUrl(raster.blob);

  const { jsPDF } = await import('jspdf');
  // Page dimensions in points using the frame's base (1×) pixels so the printed
  // size is stable regardless of the chosen DPI scale.
  const pageW = project.exportFrame.width;
  const pageH = project.exportFrame.height;
  const doc = new jsPDF({
    orientation: pageW >= pageH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageW, pageH],
    compress: true,
  });
  doc.addImage(pngDataUrl, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');

  const blob = doc.output('blob');
  const base = project.meta.name?.trim() || 'Untitled';
  return { blob, fileName: `${base.replace(/\.cartoproj$/, '')}.pdf`, width, height };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ExportError('Could not encode PDF image.'));
    reader.readAsDataURL(blob);
  });
}
