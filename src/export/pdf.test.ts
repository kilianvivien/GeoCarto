import { describe, expect, it, vi } from 'vitest';
import { createEmptyProject } from '@/project/cartoproj';

// A real (if trivial) 1x1 transparent PNG — jsPDF's addImage decodes the bytes
// (via fast-png) to embed it, so a placeholder string won't do.
const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function onePixelPngBlob(): Blob {
  const bytes = Uint8Array.from(atob(ONE_PIXEL_PNG_BASE64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}

// The raster pipeline needs a real WebGL image decoder and the vector pipeline
// needs real DOM text-metrics/getBBox — neither available in jsdom without the
// `canvas` npm package (no `renderAnnotations.test.ts`/canvas polyfill exists
// in this repo either). Mock the exporters/converter `pdf.ts` delegates to so
// this test exercises pdf.ts's own mode-branching/page-assembly logic; the
// real SVG→PDF conversion fidelity is verified by the Playwright e2e flow.
vi.mock('./raster', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./raster')>();
  return {
    ...actual,
    exportRaster: vi.fn(async () => ({
      blob: onePixelPngBlob(),
      fileName: 'test.png',
      width: 100,
      height: 100,
    })),
  };
});

vi.mock('./svg', () => ({
  exportSvg: vi.fn(async () => ({
    blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'], {
      type: 'image/svg+xml',
    }),
    fileName: 'test.svg',
    width: 100,
    height: 100,
  })),
}));

vi.mock('svg2pdf.js', () => ({
  svg2pdf: vi.fn(async (_element: unknown, pdf: import('jspdf').jsPDF) => {
    // Stand-in for the real conversion: write real text content so the
    // resulting PDF is still well-formed (non-empty content stream).
    pdf.text('vector content', 5, 5);
    return pdf;
  }),
}));

function fixtureProject() {
  const project = createEmptyProject('Test');
  project.exportFrame = { width: 100, height: 100 };
  return project;
}

async function pdfHeader(blob: Blob): Promise<string> {
  // jsdom's Blob lacks `.arrayBuffer()`; `.text()` is polyfilled in test/setup.ts.
  const text = await blob.text();
  return text.slice(0, 4);
}

describe('exportPdf', () => {
  it('raster mode produces a well-formed PDF via the raster pipeline', async () => {
    const { exportPdf } = await import('./pdf');
    const result = await exportPdf(fixtureProject(), { scale: 1, mode: 'raster' });
    expect(result.blob.type).toBe('application/pdf');
    expect(result.blob.size).toBeGreaterThan(0);
    expect(await pdfHeader(result.blob)).toBe('%PDF');
    expect(result.fileName).toBe('Test.pdf');
  });

  it('vector mode produces a well-formed PDF via the SVG exporter + svg2pdf', async () => {
    const { exportPdf } = await import('./pdf');
    const result = await exportPdf(fixtureProject(), { scale: 1, mode: 'vector' });
    expect(result.blob.type).toBe('application/pdf');
    expect(result.blob.size).toBeGreaterThan(0);
    expect(await pdfHeader(result.blob)).toBe('%PDF');
  });

  it('rejects invalid export frame dimensions before touching either pipeline', async () => {
    const { exportPdf } = await import('./pdf');
    const project = fixtureProject();
    project.exportFrame.width = 0;
    await expect(exportPdf(project, { scale: 1, mode: 'vector' })).rejects.toThrow();
  });
});
