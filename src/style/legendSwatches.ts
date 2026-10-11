import type {
  Annotation,
  AnnotationStyle,
  CategoricalStyle,
  ChoroplethStyle,
  GeoJsonLayer,
  LegendEntry,
  LegendFillStyle,
  LegendSymbol,
  ProportionalStyle,
} from '@/project/cartoproj';
import { scanAttribute } from './classify';
import { countOther } from './categories';
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

/** Three representative proportional-symbol sizes, materialized into a linked legend. */
export function proportionalLegendEntries(dataStyle: ProportionalStyle, min: number, max: number): LegendEntry[] {
  const midpoint = dataStyle.scale === 'sqrt'
    ? Math.pow((Math.sqrt(Math.max(0, min)) + Math.sqrt(Math.max(0, max))) / 2, 2)
    : (min + max) / 2;
  return [
    { value: min, radius: dataStyle.minRadius },
    { value: midpoint, radius: (dataStyle.minRadius + dataStyle.maxRadius) / 2 },
    { value: max, radius: dataStyle.maxRadius },
  ].map(({ value, radius }) => ({
    label: formatNumber(value),
    swatchColor: dataStyle.color,
    symbol: { kind: 'circle', color: dataStyle.color, radius, maxRadius: dataStyle.maxRadius },
    visible: true,
  }));
}

/**
 * One legend entry per category, drawn with the symbol the layer itself uses
 * (fill swatch, line, or point), plus an "Other" row when some features fall
 * outside the listed categories.
 */
export function categoricalLegendEntries(dataStyle: CategoricalStyle, layer: GeoJsonLayer): LegendEntry[] {
  const symbolFor = (color: string): LegendSymbol => {
    if (layer.geometry === 'point') {
      return { kind: 'circle', color, radius: layer.style.pointRadius, maxRadius: layer.style.pointRadius };
    }
    if (layer.geometry === 'line') {
      return { kind: 'line', strokeColor: color, strokeWidth: layer.style.strokeWidth, strokePattern: 'solid' };
    }
    return { kind: 'fill', fillColor: color, fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 };
  };
  const entries: LegendEntry[] = dataStyle.categories.map(({ value, color }) => ({
    label: value,
    swatchColor: color,
    symbol: symbolFor(color),
    visible: true,
  }));
  if (countOther(layer.data.features, dataStyle) > 0) {
    entries.push({
      label: translate('style.otherLegend'),
      swatchColor: dataStyle.otherColor,
      symbol: symbolFor(dataStyle.otherColor),
      visible: true,
    });
  }
  return entries;
}

/** Legend entries for whichever data style a layer currently uses (empty when it has none). */
export function dataStyleLegendEntries(layer: GeoJsonLayer): LegendEntry[] {
  const dataStyle = layer.style.dataStyle;
  if (!dataStyle) return [];
  if (dataStyle.kind === 'categorical') return categoricalLegendEntries(dataStyle, layer);
  const stats = scanAttribute(layer.data.features, dataStyle.attribute);
  if (dataStyle.kind === 'choropleth') return choroplethLegendEntries(dataStyle, stats.missingCount);
  return stats.values.length
    ? proportionalLegendEntries(dataStyle, stats.values[0], stats.values[stats.values.length - 1])
    : [];
}
