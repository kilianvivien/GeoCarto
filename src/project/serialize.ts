import {
  DEFAULT_ANNOTATION_STYLE,
  DEFAULT_BASEMAP,
  DEFAULT_BASEMAP_SUBLAYERS,
  type CartoProject,
} from './cartoproj';

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
  expect(isObject(value), 'Project file is not a JSON object.');
  expect(value.version === 1, `Unsupported project version: ${String(value.version)}.`);
  expect(
    value.mode === 'mapSetup' || value.mode === 'editing',
    'Project mode must be "mapSetup" or "editing".',
  );

  const meta = value.meta;
  expect(isObject(meta), 'Project is missing meta block.');
  expect(typeof meta.name === 'string', 'Project meta.name must be a string.');
  expect(typeof meta.createdAt === 'string', 'Project meta.createdAt must be a string.');
  expect(typeof meta.updatedAt === 'string', 'Project meta.updatedAt must be a string.');

  const viewport = value.viewport;
  expect(isObject(viewport), 'Project viewport missing.');
  expect(
    Array.isArray(viewport.center) &&
      viewport.center.length === 2 &&
      typeof viewport.center[0] === 'number' &&
      typeof viewport.center[1] === 'number',
    'Viewport center must be [lng, lat].',
  );
  for (const key of ['zoom', 'bearing', 'pitch'] as const) {
    expect(typeof viewport[key] === 'number', `Viewport ${key} must be a number.`);
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
    'Export frame must be { width, height }.',
  );

  if (!('basemap' in value)) value.basemap = { ...DEFAULT_BASEMAP };
  expect(isObject(value.basemap), 'Project basemap missing.');
  // M11: built-in / pmtiles-url basemaps gained editorial sub-layer toggles.
  // Older v1 documents are missing the field — default to all visible.
  const basemapKind = (value.basemap as { kind?: unknown }).kind;
  if (basemapKind === 'builtin' || basemapKind === 'pmtiles-url') {
    const current = (value.basemap as { sublayers?: unknown }).sublayers;
    (value.basemap as { sublayers: unknown }).sublayers = {
      ...DEFAULT_BASEMAP_SUBLAYERS,
      ...(isObject(current) ? current : {}),
    };
  }
  if (!('lockedMapView' in value)) value.lockedMapView = null;
  if (!('annotations' in value)) value.annotations = [];
  if (!('annotationGroups' in value)) value.annotationGroups = [];
  expect(Array.isArray(value.layers), 'Project layers must be an array.');
  expect(Array.isArray(value.annotations), 'Project annotations must be an array.');
  expect(Array.isArray(value.annotationGroups), 'Project annotationGroups must be an array.');
  expect(
    value.lockedMapView === null || isObject(value.lockedMapView),
    'Project lockedMapView must be null or an object.',
  );
  for (const annotation of value.annotations) {
    if (isObject(annotation) && isObject(annotation.style)) {
      annotation.style = { ...DEFAULT_ANNOTATION_STYLE, ...annotation.style };
    }
  }
}

export function deserializeProject(json: string): CartoProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new ProjectLoadError(`Invalid JSON: ${(error as Error).message}`);
  }
  validateProject(parsed);
  return parsed;
}
