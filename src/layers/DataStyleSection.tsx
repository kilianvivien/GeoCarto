import { useMemo } from 'react';
import { Check, CircleDot, Palette, Square } from 'lucide-react';
import type {
  Annotation,
  ChoroplethStyle,
  ClassificationMethod,
  DataStyle,
  GeoJsonLayer,
  ProportionalStyle,
} from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { hintHistoryLabel } from '@/state/historyStore';
import { computeBreaks, dedupeAscending, listNumericAttributes, scanAttribute } from '@/style/classify';
import { choroplethLegendEntries } from '@/style/legendSwatches';
import { COLOR_RAMPS, DEFAULT_RAMP_ID, sampleRamp } from '@/style/ramps';
import { createAnnotation } from '@/tools/annotationFactory';
import { DEFAULT_ANNOTATION_STYLE } from '@/project/cartoproj';
import { useLocale } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';
import { Swatches } from '@/ui/Swatches';

type DataStyleMode = 'single' | 'choropleth' | 'proportional';

const METHOD_LABEL_KEYS: Record<ClassificationMethod, TranslationKey> = {
  quantile: 'style.methodQuantile',
  equal: 'style.methodEqual',
  jenks: 'style.methodJenks',
  manual: 'style.methodManual',
};

function modeOf(dataStyle: DataStyle | undefined): DataStyleMode {
  if (dataStyle?.kind === 'choropleth') return 'choropleth';
  if (dataStyle?.kind === 'proportional') return 'proportional';
  return 'single';
}

const DEFAULT_CLASS_COUNT = 5;
const DEFAULT_MISSING_COLOR = '#cccccc';

function buildChoropleth(
  layer: GeoJsonLayer,
  attribute: string,
  patch: Partial<Pick<ChoroplethStyle, 'method' | 'classCount' | 'paletteId' | 'reverse' | 'missingColor'>> = {},
): ChoroplethStyle {
  const current = layer.style.dataStyle?.kind === 'choropleth' ? layer.style.dataStyle : null;
  const method = patch.method ?? current?.method ?? 'quantile';
  const classCount = patch.classCount ?? current?.classCount ?? DEFAULT_CLASS_COUNT;
  const paletteId = patch.paletteId ?? current?.paletteId ?? DEFAULT_RAMP_ID;
  const reverse = patch.reverse ?? current?.reverse ?? false;
  const missingColor = patch.missingColor ?? current?.missingColor ?? DEFAULT_MISSING_COLOR;
  const keepManualBreaks = method === 'manual' && current?.attribute === attribute && current.method === 'manual';
  const stats = scanAttribute(layer.data.features, attribute);
  const breaks = keepManualBreaks ? current.breaks : computeBreaks(stats.values, method, classCount);
  return { kind: 'choropleth', attribute, method, classCount, breaks, paletteId, reverse, missingColor };
}

function buildProportional(
  layer: GeoJsonLayer,
  attribute: string,
  patch: Partial<Pick<ProportionalStyle, 'minRadius' | 'maxRadius' | 'scale' | 'color'>> = {},
): ProportionalStyle {
  const current = layer.style.dataStyle?.kind === 'proportional' ? layer.style.dataStyle : null;
  return {
    kind: 'proportional',
    attribute,
    minRadius: patch.minRadius ?? current?.minRadius ?? 4,
    maxRadius: patch.maxRadius ?? current?.maxRadius ?? 24,
    scale: patch.scale ?? current?.scale ?? 'sqrt',
    color: patch.color ?? current?.color ?? layer.style.pointColor,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  'min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]';
const numberClass =
  'min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]';

/** "Style by data" — choropleth / proportional-symbol styling for a GeoJSON layer. */
export function DataStyleSection({ layer }: { layer: GeoJsonLayer }) {
  const t = useLocale((s) => s.t);
  const updateLayerStyle = useDocumentStore((s) => s.updateLayerStyle);
  const addAnnotation = useDocumentStore((s) => s.addAnnotation);
  const updateAnnotation = useDocumentStore((s) => s.updateAnnotation);
  const annotations = useDocumentStore((s) => s.project.annotations);
  const documentMode = useDocumentStore((s) => s.project.mode);
  const disabled = layer.locked;
  const mode = modeOf(layer.style.dataStyle);
  const canChoropleth = layer.geometry === 'polygon' || layer.geometry === 'mixed';
  const canProportional = layer.geometry === 'point' || layer.geometry === 'mixed';

  const numericAttributes = useMemo(() => listNumericAttributes(layer.data.features), [layer.data.features]);

  const setDataStyle = (dataStyle: DataStyle | undefined) => {
    hintHistoryLabel('Style by data');
    updateLayerStyle(layer.id, { dataStyle });
  };

  const setMode = (next: DataStyleMode) => {
    if (next === 'single') {
      setDataStyle(undefined);
      return;
    }
    const attribute = numericAttributes[0] ?? '';
    if (next === 'choropleth') setDataStyle(buildChoropleth(layer, attribute));
    else setDataStyle(buildProportional(layer, attribute));
  };

  const choropleth = layer.style.dataStyle?.kind === 'choropleth' ? layer.style.dataStyle : null;
  const proportional = layer.style.dataStyle?.kind === 'proportional' ? layer.style.dataStyle : null;

  const missingCount = choropleth ? scanAttribute(layer.data.features, choropleth.attribute).missingCount : 0;

  const linkedLegend = useMemo(
    () => annotations.find((a) => a.kind === 'legend' && a.dataStyleLink?.layerId === layer.id),
    [annotations, layer.id],
  );

  const createOrRefreshLegend = () => {
    if (!choropleth || documentMode !== 'editing') return;
    const entries = choroplethLegendEntries(choropleth, missingCount);
    if (linkedLegend) {
      hintHistoryLabel('Refresh legend');
      updateAnnotation(linkedLegend.id, { entries } as Partial<Annotation>);
      return;
    }
    hintHistoryLabel('Add legend');
    const annotation = createAnnotation({
      kind: 'legend',
      anchorMode: 'canvas',
      position: { x: 40, y: 40 },
      geoAnchor: null,
      style: { ...DEFAULT_ANNOTATION_STYLE },
    });
    if (annotation.kind !== 'legend') return;
    addAnnotation({
      ...annotation,
      title: layer.name,
      entries,
      dataStyleLink: { layerId: layer.id },
    });
  };

  return (
    <div className={`flex flex-col gap-2 ${disabled ? 'opacity-65' : ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
        {t('style.dataStyleTitle')}
      </div>
      <div className="flex flex-col gap-0.5 rounded-[9px] border border-[var(--divider)] bg-[var(--glass-thin)] p-1">
        {(
          [
            { value: 'single', labelKey: 'style.dataStyleSingle', icon: Square, enabled: true },
            { value: 'choropleth', labelKey: 'style.dataStyleChoropleth', icon: Palette, enabled: canChoropleth },
            { value: 'proportional', labelKey: 'style.dataStyleProportional', icon: CircleDot, enabled: canProportional },
          ] as const
        ).map((option) => {
          const active = option.value === mode;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={disabled || !option.enabled}
              onClick={() => setMode(option.value)}
              className={`flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="flex-1 truncate">{t(option.labelKey)}</span>
              {active && <Check size={13} className="shrink-0" />}
            </button>
          );
        })}
      </div>

      {mode === 'choropleth' && choropleth && (
        <div className="flex flex-col gap-2">
          {numericAttributes.length === 0 ? (
            <div className="text-[11.5px] text-[var(--text-3)]">{t('style.dataStyleNoAttributes')}</div>
          ) : (
            <>
              <Field label={t('style.dataStyleAttribute')}>
                <select
                  disabled={disabled}
                  value={choropleth.attribute}
                  onChange={(event) => setDataStyle(buildChoropleth(layer, event.target.value))}
                  className={selectClass}
                >
                  {numericAttributes.map((attribute) => (
                    <option key={attribute} value={attribute}>
                      {attribute}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('style.dataStyleMethod')}>
                <select
                  disabled={disabled}
                  value={choropleth.method}
                  onChange={(event) =>
                    setDataStyle(buildChoropleth(layer, choropleth.attribute, { method: event.target.value as ClassificationMethod }))
                  }
                  className={selectClass}
                >
                  {(['quantile', 'equal', 'jenks', 'manual'] as const).map((method) => (
                    <option key={method} value={method}>
                      {t(METHOD_LABEL_KEYS[method])}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('style.dataStyleClassCount')}>
                <input
                  type="number"
                  min={3}
                  max={9}
                  disabled={disabled}
                  value={choropleth.classCount}
                  onChange={(event) => {
                    const classCount = Math.max(3, Math.min(9, Number(event.target.value) || 3));
                    setDataStyle(buildChoropleth(layer, choropleth.attribute, { classCount }));
                  }}
                  className={numberClass}
                />
              </Field>
              {choropleth.method === 'manual' && (
                <Field label={t('style.dataStyleManualBreaks')}>
                  <input
                    type="text"
                    disabled={disabled}
                    defaultValue={choropleth.breaks.join(', ')}
                    onBlur={(event) => {
                      const breaks = dedupeAscending(
                        event.target.value
                          .split(',')
                          .map((part) => Number(part.trim()))
                          .filter((value) => Number.isFinite(value))
                          .sort((a, b) => a - b),
                      );
                      hintHistoryLabel('Style by data');
                      updateLayerStyle(layer.id, { dataStyle: { ...choropleth, breaks } });
                    }}
                    className={numberClass}
                  />
                </Field>
              )}
              <Field label={t('style.dataStylePalette')}>
                <select
                  disabled={disabled}
                  value={choropleth.paletteId}
                  onChange={(event) => setDataStyle(buildChoropleth(layer, choropleth.attribute, { paletteId: event.target.value }))}
                  className={selectClass}
                >
                  {COLOR_RAMPS.map((ramp) => (
                    <option key={ramp.id} value={ramp.id}>
                      {ramp.name}
                      {ramp.colorblindSafe ? '' : ` (${t('style.dataStyleNotColorblindSafe')})`}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex h-4 gap-0.5 overflow-hidden rounded-[4px]">
                {sampleRamp(choropleth.paletteId, choropleth.breaks.length + 1, choropleth.reverse).map((color, i) => (
                  <div key={i} className="flex-1" style={{ background: color }} />
                ))}
              </div>
              <label className="flex items-center justify-between gap-3 text-[11.5px] text-[var(--text-3)]">
                <span>{t('style.dataStyleReverse')}</span>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={choropleth.reverse}
                  onChange={(event) => setDataStyle(buildChoropleth(layer, choropleth.attribute, { reverse: event.target.checked }))}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
              </label>
              <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
                {t('style.dataStyleMissingColor')}
                <Swatches
                  value={choropleth.missingColor}
                  disabled={disabled}
                  onChange={(missingColor) => setDataStyle(buildChoropleth(layer, choropleth.attribute, { missingColor }))}
                />
              </div>
              {missingCount > 0 && (
                <div className="text-[11px] text-[var(--text-3)]">
                  {t('style.dataStyleMissingCount', { count: missingCount })}
                </div>
              )}
              <button
                type="button"
                disabled={disabled || documentMode !== 'editing'}
                onClick={createOrRefreshLegend}
                className="self-start rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1 text-[11.5px] text-[var(--text-2)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {linkedLegend ? t('style.dataStyleRefreshLegend') : t('style.dataStyleCreateLegend')}
              </button>
            </>
          )}
        </div>
      )}

      {mode === 'proportional' && proportional && (
        <div className="flex flex-col gap-2">
          {numericAttributes.length === 0 ? (
            <div className="text-[11.5px] text-[var(--text-3)]">{t('style.dataStyleNoAttributes')}</div>
          ) : (
            <>
              <Field label={t('style.dataStyleAttribute')}>
                <select
                  disabled={disabled}
                  value={proportional.attribute}
                  onChange={(event) => setDataStyle(buildProportional(layer, event.target.value))}
                  className={selectClass}
                >
                  {numericAttributes.map((attribute) => (
                    <option key={attribute} value={attribute}>
                      {attribute}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('style.dataStyleMinRadius')}>
                <input
                  type="number"
                  min={1}
                  max={60}
                  disabled={disabled}
                  value={proportional.minRadius}
                  onChange={(event) =>
                    setDataStyle(buildProportional(layer, proportional.attribute, { minRadius: Math.max(1, Number(event.target.value) || 1) }))
                  }
                  className={numberClass}
                />
              </Field>
              <Field label={t('style.dataStyleMaxRadius')}>
                <input
                  type="number"
                  min={1}
                  max={120}
                  disabled={disabled}
                  value={proportional.maxRadius}
                  onChange={(event) =>
                    setDataStyle(buildProportional(layer, proportional.attribute, { maxRadius: Math.max(1, Number(event.target.value) || 1) }))
                  }
                  className={numberClass}
                />
              </Field>
              <Field label={t('style.dataStyleScale')}>
                <select
                  disabled={disabled}
                  value={proportional.scale}
                  onChange={(event) =>
                    setDataStyle(buildProportional(layer, proportional.attribute, { scale: event.target.value as 'sqrt' | 'linear' }))
                  }
                  className={selectClass}
                >
                  <option value="sqrt">{t('style.scaleSqrt')}</option>
                  <option value="linear">{t('style.scaleLinear')}</option>
                </select>
              </Field>
              <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
                {t('style.dataStyleColor')}
                <Swatches
                  value={proportional.color}
                  disabled={disabled}
                  onChange={(color) => setDataStyle(buildProportional(layer, proportional.attribute, { color }))}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
