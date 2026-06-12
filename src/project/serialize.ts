import {
  DEFAULT_ANNOTATION_STYLE,
  DEFAULT_BASEMAP,
  DEFAULT_BASEMAP_SUBLAYERS,
  DEFAULT_GEOJSON_STYLE,
  type CartoProject,
} from './cartoproj';
import { translate } from '@/i18n/useLocale';

export class ProjectLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectLoadError';
  }
}

export function serializeProject(project: CartoProject): string {
  return JSON.stringify(project, null, 2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ProjectLoadError(message);
}

function validateProject(value: unknown): asserts value is CartoProject {
  expect(isObject(value), translate('errors.notJsonObject'));
  expect(value.version === 1, translate('errors.unsupportedVersion', { version: String(value.version) }));
  expect(value.mode === 'mapSetup' || value.mode === 'editing', translate('errors.invalidMode'));

  const meta = value.meta;
  expect(isObject(meta), translate('errors.missingMeta'));
  expect(typeof meta.name === 'string', translate('errors.metaName'));
  expect(typeof meta.createdAt === 'string', translate('errors.metaCreatedAt'));
  expect(typeof meta.updatedAt === 'string', translate('errors.metaUpdatedAt'));

  const viewport = value.viewport;
  expect(isObject(viewport), translate('errors.viewportMissing'));
  expect(
    Array.isArray(viewport.center) &&
      viewport.center.length === 2 &&
      typeof viewport.center[0] === 'number' &&
      typeof viewport.center[1] === 'number',
    translate('errors.viewportCenter'),
  );
  for (const key of ['zoom', 'bearing', 'pitch'] as const) {
    expect(typeof viewport[key] === 'number', translate('errors.viewportNumber', { key }));
  }

  const frame = value.exportFrame;
  expect(
    isObject(frame) &&
      typeof frame.width === 'number' &&
      Number.isFinite(frame.width) &&
      frame.width > 0 &&
      typeof frame.height === 'number' &&
      Number.isFinite(frame.height) &&
      frame.height > 0,
    translate('errors.exportFrame'),
  );
  // Page settings (margin / background / dpiScale / preset) arrived after v1 ship.
  // Old documents don't have them — default sensibly so the new Style panel works.
  const frameRecord = frame as Record<string, unknown>;
  if (typeof frameRecord.margin !== 'number' || frameRecord.margin < 0) frameRecord.margin = 0;
  if (
    typeof frameRecord.background !== 'string' ||
    frameRecord.background.trim() === ''
  ) {
    frameRecord.background = 'white';
  }
  if (
    typeof frameRecord.dpiScale !== 'number' ||
    !Number.isFinite(frameRecord.dpiScale) ||
    (frameRecord.dpiScale as number) <= 0
  ) {
    frameRecord.dpiScale = 1;
  }

  if (!('basemap' in value)) value.basemap = { ...DEFAULT_BASEMAP };
  expect(isObject(value.basemap), translate('errors.basemapMissing'));
  // M11/M24: Protomaps-derived basemaps gained editorial sub-layer toggles.
  // Older v1 documents are missing the field — default to all visible.
  const basemapKind = (value.basemap as { kind?: unknown }).kind;
  if (basemapKind === 'builtin' || basemapKind === 'pmtiles-url' || basemapKind === 'pmtiles-file') {
    const current = (value.basemap as { sublayers?: unknown }).sublayers;
    const labelsHidden = isObject(current) && current.labels === false;
    const landuseHidden = isObject(current) && current.landuse === false;
    (value.basemap as { sublayers: unknown }).sublayers = {
      ...DEFAULT_BASEMAP_SUBLAYERS,
      ...(isObject(current) ? current : {}),
      ...(labelsHidden ? { places: false, pois: false } : {}),
      ...(landuseHidden ? { landcover: false } : {}),
    };
  }
  if (!('lockedMapView' in value)) value.lockedMapView = null;
  if (!('annotations' in value)) value.annotations = [];
  if (!('annotationGroups' in value)) value.annotationGroups = [];
  expect(Array.isArray(value.layers), translate('errors.layersArray'));
  // M12: layers gained a render strategy. Older documents default to vector.
  for (const layer of value.layers as unknown[]) {
    if (!isObject(layer)) continue;
    if (layer.renderStrategy !== 'vector' && layer.renderStrategy !== 'heatmap') {
      layer.renderStrategy = 'vector';
    }
    // Hatch fill fields arrived after Phase 1 — default them so the richer
    // layer fill controls work on older documents.
    if (isObject(layer.style)) {
      layer.style = {
        featureFillColors: DEFAULT_GEOJSON_STYLE.featureFillColors,
        featureFillStyles: DEFAULT_GEOJSON_STYLE.featureFillStyles,
        fillPattern: DEFAULT_GEOJSON_STYLE.fillPattern,
        hatchColor: DEFAULT_GEOJSON_STYLE.hatchColor,
        hatchSpacing: DEFAULT_GEOJSON_STYLE.hatchSpacing,
        showPoints: DEFAULT_GEOJSON_STYLE.showPoints,
        ...layer.style,
      };
    }
  }
  expect(Array.isArray(value.annotations), translate('errors.annotationsArray'));
  expect(Array.isArray(value.annotationGroups), translate('errors.annotationGroupsArray'));
  expect(
    value.lockedMapView === null || isObject(value.lockedMapView),
    translate('errors.lockedMapView'),
  );
  for (const annotation of value.annotations) {
    if (isObject(annotation) && isObject(annotation.style)) {
      annotation.style = { ...DEFAULT_ANNOTATION_STYLE, ...annotation.style };
    }
    if (isObject(annotation) && annotation.kind === 'legend' && Array.isArray(annotation.entries)) {
      for (const entry of annotation.entries) {
        if (!isObject(entry)) continue;
        const swatchColor = typeof entry.swatchColor === 'string' ? entry.swatchColor : DEFAULT_ANNOTATION_STYLE.fillColor;
        entry.swatchColor = swatchColor;
        const fillStyle = {
          fillColor: swatchColor,
          fillPattern: 'none',
          hatchColor: DEFAULT_ANNOTATION_STYLE.hatchColor,
          hatchSpacing: DEFAULT_ANNOTATION_STYLE.hatchSpacing,
          ...(isObject(entry.fillStyle) ? entry.fillStyle : {}),
        };
        entry.fillStyle = fillStyle;
        const symbol = isObject(entry.symbol) ? entry.symbol : null;
        switch (symbol?.kind) {
          case 'fill': {
            const normalizedFillSymbol = {
              kind: 'fill',
              fillColor: typeof symbol.fillColor === 'string' ? symbol.fillColor : fillStyle.fillColor,
              fillPattern: typeof symbol.fillPattern === 'string' ? symbol.fillPattern : fillStyle.fillPattern,
              hatchColor: typeof symbol.hatchColor === 'string' ? symbol.hatchColor : fillStyle.hatchColor,
              hatchSpacing: typeof symbol.hatchSpacing === 'number' ? symbol.hatchSpacing : fillStyle.hatchSpacing,
            };
            entry.symbol = normalizedFillSymbol;
            entry.swatchColor = normalizedFillSymbol.fillColor;
            entry.fillStyle = {
              fillColor: normalizedFillSymbol.fillColor,
              fillPattern: normalizedFillSymbol.fillPattern,
              hatchColor: normalizedFillSymbol.hatchColor,
              hatchSpacing: normalizedFillSymbol.hatchSpacing,
            };
            break;
          }
          case 'line':
          case 'arrow':
          case 'measurement':
            entry.symbol = {
              kind: symbol.kind,
              strokeColor: typeof symbol.strokeColor === 'string' ? symbol.strokeColor : DEFAULT_ANNOTATION_STYLE.strokeColor,
              strokeWidth: typeof symbol.strokeWidth === 'number' ? symbol.strokeWidth : DEFAULT_ANNOTATION_STYLE.strokeWidth,
              strokePattern: typeof symbol.strokePattern === 'string' ? symbol.strokePattern : DEFAULT_ANNOTATION_STYLE.strokePattern,
              brushPreset: typeof symbol.brushPreset === 'string' ? symbol.brushPreset : undefined,
            };
            break;
          case 'pin':
            entry.symbol = {
              kind: 'pin',
              pinColor: typeof symbol.pinColor === 'string' ? symbol.pinColor : DEFAULT_ANNOTATION_STYLE.pinColor,
              pinIcon: typeof symbol.pinIcon === 'string' ? symbol.pinIcon : DEFAULT_ANNOTATION_STYLE.pinIcon,
            };
            break;
          default:
            entry.symbol = { kind: 'fill', ...fillStyle };
        }
      }
    }
  }
}

export function deserializeProject(json: string): CartoProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new ProjectLoadError(translate('errors.invalidJson', { message: (error as Error).message }));
  }
  validateProject(parsed);
  return parsed;
}
