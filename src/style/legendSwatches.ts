import type { AnnotationStyle, LegendEntry, LegendFillStyle } from '@/project/cartoproj';

export function legendFillFromStyle(style: AnnotationStyle): LegendFillStyle {
  return {
    fillColor: style.fillColor,
    fillPattern: style.fillPattern,
    hatchColor: style.hatchColor,
    hatchSpacing: style.hatchSpacing,
  };
}

export function legendEntryFill(entry: LegendEntry): LegendFillStyle {
  return entry.fillStyle ?? {
    fillColor: entry.swatchColor,
    fillPattern: 'none',
    hatchColor: '#0f172a',
    hatchSpacing: 10,
  };
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
