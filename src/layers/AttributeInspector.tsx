import { useState } from 'react';
import type { FillPattern } from '@/project/cartoproj';
import { DEFAULT_GEOJSON_STYLE } from '@/project/cartoproj';
import { FEATURE_FILL_PROPERTY, featureFillKey, labelForFeature } from '@/layers/geojsonFeatureStyle';
import { useDocumentStore } from '@/state/documentStore';
import { useEditStore } from '@/state/editStore';
import { EditAttributePanel } from '@/layers/EditAttributePanel';
import { Swatches } from '@/ui/Swatches';
import { FILL_PATTERNS } from '@/ui/swatchPalette';
import { useLocale } from '@/i18n/useLocale';

function fillPatternLabel(value: string, t: ReturnType<typeof useLocale.getState>['t']): string {
  if (value === 'none') return t('pattern.solid');
  if (value === 'diagonal') return t('pattern.diagonal');
  if (value === 'crosshatch') return t('pattern.crosshatch');
  if (value === 'horizontal') return t('pattern.horizontal');
  if (value === 'vertical') return t('pattern.vertical');
  if (value === 'dots') return t('pattern.dots');
  return value;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
      {children}
    </div>
  );
}

function FeatureAttributes({ entries }: { entries: [string, unknown][] }) {
  const t = useLocale((s) => s.t);
  const [open, setOpen] = useState(false);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-[7px] py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
        {t('attributes.attributes')}
        <span className="text-[11px] normal-case tracking-normal">{open ? t('attributes.hide') : t('attributes.show')}</span>
      </summary>
      {entries.length === 0 ? (
        <div className="mt-2 text-[12px] text-[var(--text-3)]">{t('attributes.noProperties')}</div>
      ) : (
        <div className="mt-2 flex flex-col gap-px rounded-[8px] bg-[var(--glass-thin)] p-1">
          {entries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[88px_1fr] gap-2 px-1.5 py-1">
              <span className="truncate text-[11.5px] text-[var(--text-3)]">{key}</span>
              <span className="mono truncate text-[11.5px] text-[var(--text)]">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

/** Properties pane — feature attributes when a feature is picked, else layer info. */
export function AttributeInspector() {
  const t = useLocale((s) => s.t);
  const feature = useDocumentStore((s) => s.selectedFeature);
  const layers = useDocumentStore((s) => s.project.layers);
  const selectedLayerId = useDocumentStore((s) => s.selectedLayerId);
  const updateLayerStyle = useDocumentStore((s) => s.updateLayerStyle);
  const setLayerRenderStrategy = useDocumentStore((s) => s.setLayerRenderStrategy);
  const editingLayerId = useEditStore((s) => s.editingLayerId);
  const selectedFeatureId = useEditStore((s) => s.selectedFeatureId);

  // While the vector editor is active, the inspector edits feature attributes.
  if (editingLayerId) {
    const editingLayer = layers.find((l) => l.id === editingLayerId);
    if (editingLayer) {
      const editingFeature =
        editingLayer.data.features.find((f) => f.id === selectedFeatureId) ?? null;
      return <EditAttributePanel layer={editingLayer} feature={editingFeature} />;
    }
  }

  if (feature) {
    const layer = layers.find((l) => l.id === feature.layerId);
    const entries = Object.entries(feature.properties).filter(
      ([key]) => key !== FEATURE_FILL_PROPERTY,
    );
    const fillKey = feature.fillKey ?? featureFillKey(feature.properties);
    const featureFillStyle =
      fillKey && layer
        ? (layer.style.featureFillStyles?.[fillKey] ?? {
            fillColor: layer.style.featureFillColors?.[fillKey] ?? layer.style.fillColor,
            fillPattern: layer.style.fillPattern,
            hatchColor: layer.style.hatchColor,
            hatchSpacing: layer.style.hatchSpacing,
          })
        : null;
    const featureLabel = labelForFeature(feature.properties);
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Eyebrow>{t('attributes.feature')}</Eyebrow>
          <div className="mt-1 text-[13px] font-semibold text-[var(--text)]">
            {featureLabel === 'Selected feature' ? t('attributes.selectedFeature') : featureLabel}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-[var(--text-3)]">
            {layer?.name ?? t('attributes.unknownLayer')}
          </div>
        </div>
        {layer && (
          <div className={`flex flex-col gap-2 ${layer.locked || !fillKey ? 'opacity-65' : ''}`}>
            <Eyebrow>{t('attributes.featureStyle')}</Eyebrow>
            <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
              {t('attributes.fill')}
              <Swatches
                value={featureFillStyle?.fillColor ?? layer.style.fillColor}
                disabled={layer.locked || !fillKey}
                onChange={(color) => {
                  if (!fillKey) return;
                  updateLayerStyle(layer.id, {
                    featureFillStyles: {
                      ...(layer.style.featureFillStyles ?? {}),
                      [fillKey]: {
                        ...(featureFillStyle ?? DEFAULT_GEOJSON_STYLE),
                        fillColor: color,
                      },
                    },
                  });
                }}
              />
            </div>
            <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
              {t('attributes.hatch')}
              <select
                aria-label="Feature fill pattern"
                value={featureFillStyle?.fillPattern ?? layer.style.fillPattern}
                disabled={layer.locked || !fillKey}
                onChange={(event) => {
                  if (!fillKey) return;
                  updateLayerStyle(layer.id, {
                    featureFillStyles: {
                      ...(layer.style.featureFillStyles ?? {}),
                      [fillKey]: {
                        ...(featureFillStyle ?? DEFAULT_GEOJSON_STYLE),
                        fillPattern: event.target.value as FillPattern,
                      },
                    },
                  });
                }}
                className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
              >
                {FILL_PATTERNS.map((pattern) => (
                  <option key={pattern.value} value={pattern.value}>
                    {fillPatternLabel(pattern.value, t)}
                  </option>
                ))}
              </select>
            </label>
            {featureFillStyle?.fillPattern !== 'none' && (
              <>
                <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
                  {t('attributes.hatchColor')}
                  <Swatches
                    value={featureFillStyle?.hatchColor ?? layer.style.hatchColor}
                    disabled={layer.locked || !fillKey}
                    onChange={(hatchColor) => {
                      if (!fillKey) return;
                      updateLayerStyle(layer.id, {
                        featureFillStyles: {
                          ...(layer.style.featureFillStyles ?? {}),
                          [fillKey]: {
                            ...(featureFillStyle ?? DEFAULT_GEOJSON_STYLE),
                            hatchColor,
                          },
                        },
                      });
                    }}
                  />
                </div>
                <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
                  {t('attributes.density')}
                  <input
                    aria-label="Feature hatch spacing"
                    type="number"
                    min={4}
                    max={40}
                    value={featureFillStyle?.hatchSpacing ?? layer.style.hatchSpacing}
                    disabled={layer.locked || !fillKey}
                    onChange={(event) => {
                      if (!fillKey) return;
                      updateLayerStyle(layer.id, {
                        featureFillStyles: {
                          ...(layer.style.featureFillStyles ?? {}),
                          [fillKey]: {
                            ...(featureFillStyle ?? DEFAULT_GEOJSON_STYLE),
                            hatchSpacing: Number(event.target.value),
                          },
                        },
                      });
                    }}
                    className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
                  />
                </label>
              </>
            )}
            <button
              type="button"
              disabled={layer.locked || !fillKey || !layer.style.featureFillStyles?.[fillKey]}
              onClick={() => {
                if (!fillKey) return;
                const rest = { ...(layer.style.featureFillStyles ?? {}) };
                delete rest[fillKey];
                updateLayerStyle(layer.id, { featureFillStyles: rest });
              }}
              className="self-start rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1 text-[11.5px] text-[var(--text-2)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('attributes.resetFill')}
            </button>
            {!fillKey && (
              <div className="text-[11.5px] text-[var(--text-3)]">
                {t('attributes.noFillId')}
              </div>
            )}
          </div>
        )}
        {layer && (
          <div className={`flex flex-col gap-2 ${layer.locked ? 'opacity-65' : ''}`}>
            <Eyebrow>{t('attributes.layerStroke')}</Eyebrow>
            <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
              {t('attributes.stroke')}
              <Swatches
                value={layer.style.strokeColor}
                disabled={layer.locked}
                onChange={(strokeColor) => updateLayerStyle(layer.id, { strokeColor })}
              />
            </div>
            <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
              {t('attributes.width')}
              <input
                aria-label="Layer stroke width"
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={layer.style.strokeWidth}
                disabled={layer.locked}
                onChange={(event) => updateLayerStyle(layer.id, { strokeWidth: Number(event.target.value) })}
                className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
              />
            </label>
          </div>
        )}
        <FeatureAttributes entries={entries} />
      </div>
    );
  }

  const layer = layers.find((l) => l.id === selectedLayerId);
  if (layer) {
    const disabled = layer.locked;
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Eyebrow>{t('attributes.layer')}</Eyebrow>
          <div className="mt-1 text-[13px] font-semibold text-[var(--text)]">{layer.name}</div>
        </div>
        <div className="flex flex-col gap-px rounded-[8px] bg-[var(--glass-thin)] p-1">
          {[
            [t('attributes.geometry'), layer.geometry],
            [t('attributes.features'), String(layer.featureCount)],
            [t('attributes.visible'), layer.visible ? t('attributes.yes') : t('attributes.no')],
            [t('attributes.locked'), layer.locked ? t('attributes.yes') : t('attributes.no')],
          ].map(([key, value]) => (
            <div key={key} className="grid grid-cols-[88px_1fr] gap-2 px-1.5 py-1">
              <span className="text-[11.5px] text-[var(--text-3)]">{key}</span>
              <span className="mono text-[11.5px] text-[var(--text)]">{value}</span>
            </div>
          ))}
        </div>
        <div className={`flex flex-col gap-2 ${disabled ? 'opacity-65' : ''}`}>
          <Eyebrow>{t('attributes.layerStyle')}</Eyebrow>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('attributes.render')}
            <select
              aria-label="Layer render strategy"
              value={layer.renderStrategy ?? 'vector'}
              disabled={disabled}
              onChange={(event) =>
                setLayerRenderStrategy(layer.id, event.target.value as 'vector' | 'heatmap')
              }
              className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
            >
              <option value="vector">{t('attributes.vector')}</option>
              <option value="heatmap">{t('attributes.heatmap')}</option>
            </select>
          </label>
          <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('attributes.fill')}
            <Swatches
              value={layer.style.fillColor}
              disabled={disabled}
              onChange={(fillColor) => updateLayerStyle(layer.id, { fillColor })}
            />
          </div>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('attributes.fillOpacity')}
            <input
              aria-label="Layer fill opacity"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={layer.style.fillOpacity}
              disabled={disabled}
              onChange={(event) => updateLayerStyle(layer.id, { fillOpacity: Number(event.target.value) })}
              className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
            />
          </label>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('attributes.hatch')}
            <select
              aria-label="Layer fill pattern"
              value={layer.style.fillPattern}
              disabled={disabled}
              onChange={(event) => updateLayerStyle(layer.id, { fillPattern: event.target.value as FillPattern })}
              className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
            >
              {FILL_PATTERNS.map((pattern) => (
                <option key={pattern.value} value={pattern.value}>
                  {fillPatternLabel(pattern.value, t)}
                </option>
              ))}
            </select>
          </label>
          {layer.style.fillPattern !== 'none' && (
            <>
              <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
                {t('attributes.hatchColor')}
                <Swatches
                  value={layer.style.hatchColor}
                  disabled={disabled}
                  onChange={(hatchColor) => updateLayerStyle(layer.id, { hatchColor })}
                />
              </div>
              <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
                {t('attributes.density')}
                <input
                  aria-label="Layer hatch spacing"
                  type="number"
                  min={4}
                  max={40}
                  value={layer.style.hatchSpacing}
                  disabled={disabled}
                  onChange={(event) => updateLayerStyle(layer.id, { hatchSpacing: Number(event.target.value) })}
                  className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
                />
              </label>
            </>
          )}
          <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('attributes.stroke')}
            <Swatches
              value={layer.style.strokeColor}
              disabled={disabled}
              onChange={(strokeColor) => updateLayerStyle(layer.id, { strokeColor })}
            />
          </div>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('attributes.strokeWidth')}
            <input
              aria-label="Layer stroke width"
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={layer.style.strokeWidth}
              disabled={disabled}
              onChange={(event) => updateLayerStyle(layer.id, { strokeWidth: Number(event.target.value) })}
              className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
            />
          </label>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('attributes.showPoints')}
            <input
              aria-label="Show layer point features"
              type="checkbox"
              checked={layer.style.showPoints}
              disabled={disabled}
              onChange={(event) => updateLayerStyle(layer.id, { showPoints: event.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </label>
          <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('attributes.point')}
            <Swatches
              value={layer.style.pointColor}
              disabled={disabled}
              onChange={(pointColor) => updateLayerStyle(layer.id, { pointColor })}
            />
          </div>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            {t('attributes.pointSize')}
            <input
              aria-label="Layer point radius"
              type="number"
              min={1}
              max={40}
              step={0.5}
              value={layer.style.pointRadius}
              disabled={disabled}
              onChange={(event) => updateLayerStyle(layer.id, { pointRadius: Number(event.target.value) })}
              className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
            />
          </label>
        </div>
        <div className="text-[11.5px] text-[var(--text-3)]">
          {t('attributes.inspectFeatureHelp')}
        </div>
      </div>
    );
  }

  return (
    <div className="text-[12px] text-[var(--text-3)]">
      {t('attributes.selectLayerHelp')}
    </div>
  );
}
