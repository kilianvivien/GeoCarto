import type { Annotation, AnnotationStyle, ChoroplethStyle, LegendEntry, LegendFillStyle, LegendSymbol } from '@/project/cartoproj';
import { localeNumber, translate } from '@/i18n/useLocale';
import { sampleRamp } from './ramps';

export function legendFillFromStyle(style: AnnotationStyle): LegendFillStyle {
  return {
    fillColor: style.fillColor,
    fillPattern: style.fillPattern,
    hatchColor: style.hatchColor,
    hatchSpacing: style.hatchSpacing,
  };
}

export function legendFillSymbolFromStyle(style: AnnotationStyle): LegendSymbol {
  return { kind: 'fill', ...legendFillFromStyle(style) };
}

export function legendLineSymbolFromStyle(
  style: AnnotationStyle,
  kind: 'line' | 'arrow' | 'measurement',
): LegendSymbol {
  return {
    kind,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokePattern: style.strokePattern,
    brushPreset: kind === 'line' ? style.brushPreset : undefined,
  };
}

export function legendPinSymbolFromStyle(style: AnnotationStyle): LegendSymbol {
  return {
    kind: 'pin',
    pinColor: style.pinColor,
    pinIcon: style.pinIcon,
  };
}

export function legendSymbolFromAnnotation(annotation: Annotation): LegendSymbol | null {
  switch (annotation.kind) {
    case 'rectangle':
    case 'ellipse':
    case 'polygon':
      return legendFillSymbolFromStyle(annotation.style);
    case 'line':
      return legendLineSymbolFromStyle(annotation.style, 'line');
    case 'arrow':
      return legendLineSymbolFromStyle(annotation.style, 'arrow');
    case 'measurement':
      return legendLineSymbolFromStyle(annotation.style, 'measurement');
    case 'pin':
      return legendPinSymbolFromStyle(annotation.style);
    default:
      return null;
  }
}

export function legendEntryFill(entry: LegendEntry): LegendFillStyle {
  if (entry.symbol?.kind === 'fill') {
    const { fillColor, fillPattern, hatchColor, hatchSpacing } = entry.symbol;
    return { fillColor, fillPattern, hatchColor, hatchSpacing };
  }
  return entry.fillStyle ?? {
    fillColor: entry.swatchColor,
    fillPattern: 'none',
    hatchColor: '#0f172a',
    hatchSpacing: 10,
  };
}

export function legendEntrySymbol(entry: LegendEntry): LegendSymbol {
  if (entry.symbol) return entry.symbol;
  return { kind: 'fill', ...legendEntryFill(entry) };
}

export function legendSwatchBackground(fill: LegendFillStyle): string {
  if (fill.fillPattern === 'none') return fill.fillColor;
  const spacing = Math.max(4, fill.hatchSpacing);
  const line = `${fill.hatchColor} 0 2px, transparent 2px ${spacing}px`;
  const base = `linear-gradient(${fill.fillColor}, ${fill.fillColor})`;
  switch (fill.fillPattern) {
    case 'diagonal':
      return `repeating-linear-gradient(135deg, ${line}), ${base}`;
    case 'crosshatch':
      return `repeating-linear-gradient(135deg, ${line}), repeating-linear-gradient(45deg, ${line}), ${base}`;
    case 'horizontal':
      return `repeating-linear-gradient(0deg, ${line}), ${base}`;
    case 'vertical':
      return `repeating-linear-gradient(90deg, ${line}), ${base}`;
    case 'dots':
      return `radial-gradient(circle, ${fill.hatchColor} 0 1.5px, transparent 1.7px), ${base}`;
  }
}

export function legendSwatchBackgroundSize(fill: LegendFillStyle): string | undefined {
  if (fill.fillPattern !== 'dots') return undefined;
  const spacing = Math.max(4, fill.hatchSpacing);
  return `${spacing}px ${spacing}px, auto`;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return localeNumber(rounded);
}

/**
 * Materialize legend entries from a choropleth data style — one entry per
 * class range plus a trailing "missing" swatch when the layer has any. Called
 * once when the user creates/refreshes the legend (`LegendAnnotation.dataStyleLink`);
 * entries then live in the document like any other legend, not recomputed at
 * render time.
 */
export function choroplethLegendEntries(dataStyle: ChoroplethStyle, missingCount: number): LegendEntry[] {
  const colors = sampleRamp(dataStyle.paletteId, dataStyle.breaks.length + 1, dataStyle.reverse);
  const bounds = [-Infinity, ...dataStyle.breaks, Infinity];
  const entries: LegendEntry[] = colors.map((color, i) => {
    const lower = bounds[i];
    const upper = bounds[i + 1];
    const label =
      lower === -Infinity ? `< ${formatNumber(upper)}` : upper === Infinity ? `≥ ${formatNumber(lower)}` : `${formatNumber(lower)}–${formatNumber(upper)}`;
    return {
      label,
      swatchColor: color,
      symbol: { kind: 'fill', fillColor: color, fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
      fillStyle: { fillColor: color, fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
      visible: true,
    };
  });
  if (missingCount > 0) {
    entries.push({
      label: translate('style.noDataLegend'),
      swatchColor: dataStyle.missingColor,
      symbol: { kind: 'fill', fillColor: dataStyle.missingColor, fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
      fillStyle: { fillColor: dataStyle.missingColor, fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
      visible: true,
    });
  }
  return entries;
}
