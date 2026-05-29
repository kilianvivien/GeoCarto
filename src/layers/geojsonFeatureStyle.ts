export const FEATURE_FILL_PROPERTY = '@id';

export function featureFillKey(properties: Record<string, unknown> | null | undefined): string | null {
  const value = properties?.[FEATURE_FILL_PROPERTY];
  return typeof value === 'string' && value.trim() ? value : null;
}

export function labelForFeature(properties: Record<string, unknown>): string {
  for (const key of ['name', 'name:en', 'ISO3166-2', FEATURE_FILL_PROPERTY]) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'Selected feature';
}
