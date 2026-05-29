import type {
  Annotation,
  AnnotationStyle,
  CartoProject,
  LegendFillStyle,
  PinIcon,
} from '@/project/cartoproj';
import { useMapInstance } from '@/canvas/mapInstance';
import { hatchLines, strokeDash } from '@/style/annotationPatterns';
import { legendEntryFill } from '@/style/legendSwatches';
import { measurementLabel, metersPerPixel, niceScaleBar } from '@/style/furniture';
import { ExportError, renderBasemapCanvas, type ExportResult } from './raster';

export interface SvgExportOptions {
  /** Embed the basemap (and imported data) as a raster `<image>` beneath the vectors. */
  includeBasemap: boolean;
}

/** XML-escape text content / attribute values. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function n(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0';
}

function dashAttr(style: AnnotationStyle): string {
  const dash = strokeDash(style);
  return dash ? ` stroke-dasharray="${dash.map(n).join(' ')}"` : '';
}

function pointsAttr(points: number[]): string {
  const pairs: string[] = [];
  for (let i = 0; i < points.length; i += 2) pairs.push(`${n(points[i])},${n(points[i + 1])}`);
  return pairs.join(' ');
}

function polygonLocalBounds(points: number[]) {
  const xs = points.filter((_, index) => index % 2 === 0);
  const ys = points.filter((_, index) => index % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
  };
}

function hatchSvg(
  id: string,
  fill: LegendFillStyle,
  clipShape: string,
  bounds: { x: number; y: number; width: number; height: number },
): string {
  if (fill.fillPattern === 'none') return '';
  const clipId = `gc-hatch-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const lines = hatchLines(bounds.width, bounds.height, fill.fillPattern, fill.hatchSpacing);
  if (lines.length === 0) return '';
  const segments = lines
    .map((line) => {
      const pts = line.points;
      return `<line x1="${n(pts[0] + bounds.x)}" y1="${n(pts[1] + bounds.y)}" x2="${n(pts[2] + bounds.x)}" y2="${n(pts[3] + bounds.y)}" stroke="${esc(fill.hatchColor)}" stroke-width="1.25" stroke-linecap="${fill.fillPattern === 'dots' ? 'round' : 'butt'}"/>`;
    })
    .join('');
  return (
    `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${clipShape}</clipPath></defs>` +
    `<g clip-path="url(#${clipId})" pointer-events="none">${segments}</g>`
  );
}

function textEl(
  text: string,
  x: number,
  y: number,
  style: AnnotationStyle,
  opts: { bold?: boolean; opacity?: number; size?: number } = {},
): string {
  const size = opts.size ?? style.textSize;
  // SVG <text> y is the baseline; Konva text y is the top, so offset by ~size.
  return `<text x="${n(x)}" y="${n(y + size * 0.82)}" fill="${esc(style.textColor)}" font-family="${esc(style.fontFamily)}, sans-serif" font-size="${n(size)}"${opts.bold ? ' font-weight="700"' : ''}${opts.opacity != null ? ` opacity="${n(opts.opacity)}"` : ''}>${esc(text)}</text>`;
}

function pinGlyphSvg(icon: PinIcon, color: string, size: number): string {
  const r = size / 2;
  const stroke = ' stroke="#ffffff" stroke-width="2"';
  switch (icon) {
    case 'ring':
      return `<circle r="${n(r)}" fill="none" stroke="${esc(color)}" stroke-width="4"/>`;
    case 'square':
      return `<rect x="${n(-r)}" y="${n(-r)}" width="${n(size)}" height="${n(size)}" rx="4" fill="${esc(color)}"${stroke}/>`;
    case 'triangle':
      return `<polygon points="0,${n(-r)} ${n(r)},${n(r * 0.8)} ${n(-r)},${n(r * 0.8)}" fill="${esc(color)}"${stroke}/>`;
    case 'diamond':
      return `<rect x="${n(-r * 0.72)}" y="${n(-r * 0.72)}" width="${n(r * 1.44)}" height="${n(r * 1.44)}" transform="rotate(45)" fill="${esc(color)}"${stroke}/>`;
    default:
      // dot / flag / star / cross / target collapse to a filled dot in SVG (flattened).
      return `<circle r="${n(r)}" fill="${esc(color)}"${stroke}/>`;
  }
}

/** Emit one annotation as an SVG group positioned in frame coordinates. */
function annotationToSvg(
  annotation: Annotation,
  origin: { x: number; y: number },
  scale: number,
): string {
  if (!annotation.visible) return '';
  const { style } = annotation;
  const fill = ` fill="${esc(style.fillColor)}"`;
  const stroke = ` stroke="${esc(style.strokeColor)}" stroke-width="${n(style.strokeWidth)}"`;
  let body = '';

  switch (annotation.kind) {
    case 'text':
      body = textEl(annotation.text, 8, 8, style);
      break;
    case 'rectangle':
      body =
        `<rect width="${n(annotation.width)}" height="${n(annotation.height)}" rx="${n(annotation.cornerRadius)}"${fill}${stroke}${dashAttr(style)}/>` +
        hatchSvg(
          annotation.id,
          style,
          `<rect width="${n(annotation.width)}" height="${n(annotation.height)}" rx="${n(annotation.cornerRadius)}"/>`,
          { x: 0, y: 0, width: annotation.width, height: annotation.height },
        );
      break;
    case 'ellipse':
      body =
        `<ellipse rx="${n(annotation.radiusX)}" ry="${n(annotation.radiusY)}"${fill}${stroke}${dashAttr(style)}/>` +
        hatchSvg(
          annotation.id,
          style,
          `<ellipse cx="0" cy="0" rx="${n(annotation.radiusX)}" ry="${n(annotation.radiusY)}"/>`,
          {
            x: -annotation.radiusX,
            y: -annotation.radiusY,
            width: annotation.radiusX * 2,
            height: annotation.radiusY * 2,
          },
        );
      break;
    case 'line':
      body = `<polyline points="${pointsAttr(annotation.points)}" fill="none"${stroke}${dashAttr(style)} stroke-linecap="round" stroke-linejoin="round"/>`;
      break;
    case 'arrow': {
      const pts = annotation.points;
      const x2 = pts.at(-2) ?? 0;
      const y2 = pts.at(-1) ?? 0;
      const x1 = pts.at(-4) ?? 0;
      const y1 = pts.at(-3) ?? 0;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = 12;
      const ax = x2 - head * Math.cos(angle - Math.PI / 6);
      const ay = y2 - head * Math.sin(angle - Math.PI / 6);
      const bx = x2 - head * Math.cos(angle + Math.PI / 6);
      const by = y2 - head * Math.sin(angle + Math.PI / 6);
      body =
        `<polyline points="${pointsAttr(pts)}" fill="none"${stroke}${dashAttr(style)} stroke-linecap="round" stroke-linejoin="round"/>` +
        `<polygon points="${n(x2)},${n(y2)} ${n(ax)},${n(ay)} ${n(bx)},${n(by)}" fill="${esc(style.strokeColor)}"/>`;
      break;
    }
    case 'polygon': {
      const bounds = polygonLocalBounds(annotation.points);
      body =
        `<polygon points="${pointsAttr(annotation.points)}"${fill}${stroke}${dashAttr(style)} stroke-linejoin="round"/>` +
        hatchSvg(annotation.id, style, `<polygon points="${pointsAttr(annotation.points)}"/>`, bounds);
      break;
    }
    case 'pin':
      body =
        pinGlyphSvg(style.pinIcon, style.pinColor, annotation.size) +
        textEl(annotation.label, annotation.size * 0.65, -annotation.size / 2, style);
      break;
    case 'measurement': {
      const label = measurementLabel(annotation.geoPoints, annotation.unitSystem);
      const dash = strokeDash(style) ?? [6, 5];
      body = `<polyline points="${pointsAttr(annotation.points)}" fill="none"${stroke} stroke-dasharray="${dash.map(n).join(' ')}" stroke-linecap="round"/>`;
      for (let i = 0; i < annotation.points.length; i += 2) {
        body += `<circle cx="${n(annotation.points[i])}" cy="${n(annotation.points[i + 1])}" r="4" fill="#ffffff"${stroke}/>`;
      }
      body += textEl(
        label,
        annotation.points.at(-2) ?? 0,
        (annotation.points.at(-1) ?? 0) + 10,
        style,
      );
      break;
    }
    case 'image':
      if (annotation.src) {
        body = `<image x="0" y="0" width="${n(annotation.width)}" height="${n(annotation.height)}" href="${esc(annotation.src)}" preserveAspectRatio="none"/>`;
      }
      break;
    case 'legend': {
      const padding = 10;
      const rowHeight = style.textSize + 8;
      const swatch = style.textSize;
      const visible = annotation.entries.filter((entry) => entry.visible);
      const height = padding * 2 + (style.textSize + 6) + rowHeight * visible.length;
      body = `<rect width="${n(annotation.width)}" height="${n(height)}" rx="10"${fill}${stroke}/>`;
      body += textEl(annotation.title, padding, padding, style, {
        bold: true,
        size: style.textSize + 2,
      });
      visible.forEach((entry, index) => {
        const y = padding + (style.textSize + 6) + index * rowHeight;
        const ef = legendEntryFill(entry);
        body += `<rect x="${n(padding)}" y="${n(y)}" width="${n(swatch)}" height="${n(swatch)}" rx="3" fill="${esc(ef.fillColor)}" stroke="${esc(style.strokeColor)}" stroke-width="0.5"/>`;
        body += hatchSvg(
          `${annotation.id}-entry-${index}`,
          ef,
          `<rect x="${n(padding)}" y="${n(y)}" width="${n(swatch)}" height="${n(swatch)}" rx="3"/>`,
          { x: padding, y, width: swatch, height: swatch },
        );
        body += textEl(entry.label, padding + swatch + 8, y, style);
      });
      break;
    }
    case 'titleblock':
      body = textEl(annotation.title, 0, 0, style, { bold: true, size: style.textSize + 8 });
      if (annotation.subtitle.trim() !== '') {
        body += textEl(annotation.subtitle, 0, style.textSize + 14, style, { opacity: 0.75 });
      }
      break;
    case 'sourcecredit':
      body = textEl(annotation.text, 0, 0, style, { opacity: 0.85 });
      break;
    case 'scalebar': {
      const map = useMapInstance.getState().map;
      const tick = map
        ? niceScaleBar(metersPerPixel(map), annotation.maxWidth, annotation.unitSystem)
        : { lengthPx: annotation.maxWidth, label: '—' };
      const length = Math.max(1, tick.lengthPx);
      const barH = 6;
      const sw = Math.max(1, style.strokeWidth);
      body =
        `<polyline points="0,0 0,${barH} ${n(length)},${barH} ${n(length)},0" fill="none" stroke="${esc(style.strokeColor)}" stroke-width="${n(sw)}"/>` +
        `<rect x="0" y="0" width="${n(length / 2)}" height="${barH}" fill="${esc(style.strokeColor)}"/>` +
        textEl(tick.label, 0, barH + 3, style);
      break;
    }
    case 'northarrow': {
      const map = useMapInstance.getState().map;
      const bearing = map ? map.getBearing() : 0;
      const r = annotation.size / 2;
      body =
        `<g transform="translate(${n(r)},${n(r)}) rotate(${n(-bearing)})">` +
        `<polygon points="0,${n(-r)} ${n(r * 0.5)},${n(r * 0.7)} 0,${n(r * 0.32)} ${n(-r * 0.5)},${n(r * 0.7)}" fill="${esc(style.strokeColor)}"/>` +
        textEl('N', -style.textSize / 2, -r - style.textSize - 2, style, { bold: true }) +
        `</g>`;
      break;
    }
    case 'comment':
      // Local-only review pins are omitted from exported artwork.
      return '';
  }

  if (body === '') return '';
  const transform = `translate(${n(origin.x)},${n(origin.y)}) rotate(${n(annotation.rotation)}) scale(${n(scale)})`;
  return `<g transform="${transform}" opacity="${n(annotation.opacity)}">${body}</g>`;
}

/**
 * Serialize the project to an SVG string. The basemap (and imported data) is
 * embedded as a raster `<image>`; annotations, text, and map furniture are
 * emitted as editable vector objects. Hatch fills are emitted as clipped SVG
 * strokes; halos, blend modes, and most pin glyphs are flattened — surfaced to
 * the user in the export dialog.
 */
export async function exportSvg(
  project: CartoProject,
  options: SvgExportOptions,
): Promise<ExportResult> {
  const frameW = project.exportFrame.width;
  const frameH = project.exportFrame.height;
  if (frameW <= 0 || frameH <= 0) throw new ExportError('Invalid output dimensions.');

  const map = useMapInstance.getState().map;
  const container = map?.getContainer();
  if (!container && project.basemap.kind !== 'static') throw new ExportError('Map is not ready.');
  const containerW = container?.clientWidth ?? frameW;
  const scale = frameW / containerW;

  const originOf = (annotation: Annotation): { x: number; y: number } => {
    const editor =
      annotation.anchorMode === 'map' && annotation.geoAnchor && map
        ? map.project(annotation.geoAnchor)
        : annotation.position;
    // Uniform scale on both axes to match the raster exporter's annotation
    // layer (Konva scales x and y by the same factor); using a separate Y
    // factor would offset annotations vertically whenever the container aspect
    // differs from the frame aspect — the normal case after lock.
    return { x: editor.x * scale, y: editor.y * scale };
  };

  const parts: string[] = [];
  const background = project.exportFrame.background ?? 'white';
  if (background !== 'transparent') {
    parts.push(
      `<rect x="0" y="0" width="${n(frameW)}" height="${n(frameH)}" fill="${background === 'white' ? '#ffffff' : esc(background)}"/>`,
    );
  }

  if (options.includeBasemap) {
    const canvas = await renderBasemapCanvas(project, frameW, frameH);
    parts.push(
      `<image x="0" y="0" width="${n(frameW)}" height="${n(frameH)}" href="${canvas.toDataURL('image/png')}" preserveAspectRatio="none"/>`,
    );
  }

  for (const annotation of project.annotations) {
    parts.push(annotationToSvg(annotation, originOf(annotation), scale));
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(frameW)}" height="${n(frameH)}" viewBox="0 0 ${n(frameW)} ${n(frameH)}">` +
    parts.join('') +
    `</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const base = project.meta.name?.trim() || 'Untitled';
  return {
    blob,
    fileName: `${base.replace(/\.cartoproj$/, '')}.svg`,
    width: frameW,
    height: frameH,
  };
}
