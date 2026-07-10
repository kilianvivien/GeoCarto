import { useRef, useState } from 'react';
import { Lock, MapPinned, MousePointer2, Palette, Pipette, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ColorPickerPopover } from '@/ui/ColorPickerPopover';
import { Swatches } from '@/ui/Swatches';
import type {
  Annotation,
  AnnotationAnchorMode,
  AnnotationKind,
  AnnotationStyle,
  BlendMode,
  BrushPreset,
  FillPattern,
  LegendAnnotation,
  LegendEntry,
  LegendSymbol,
  PinIcon,
  StrokePattern,
} from '@/project/cartoproj';
import { DEFAULT_ANNOTATION_STYLE } from '@/project/cartoproj';
import { useMapInstance } from '@/canvas/mapInstance';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore, toolToAnnotationKind } from '@/state/toolStore';
import { useUiStore } from '@/ui/uiStore';
import {
  legendEntrySymbol,
  legendSwatchBackground,
  legendSwatchBackgroundSize,
} from '@/style/legendSwatches';
import { useLocale } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';

const FONTS = ['Inter', 'Avenir Next', 'Helvetica Neue', 'Georgia'];
const FILL_PATTERNS: { value: FillPattern; labelKey: TranslationKey }[] = [
  { value: 'none', labelKey: 'pattern.solid' },
  { value: 'diagonal', labelKey: 'pattern.diagonal' },
  { value: 'crosshatch', labelKey: 'pattern.crosshatch' },
  { value: 'horizontal', labelKey: 'pattern.horizontal' },
  { value: 'vertical', labelKey: 'pattern.vertical' },
  { value: 'dots', labelKey: 'pattern.dots' },
];
const BRUSH_PRESETS: { value: BrushPreset; labelKey: TranslationKey; width: number }[] = [
  { value: 'round', labelKey: 'brush.round', width: 2 },
  { value: 'marker', labelKey: 'brush.marker', width: 5 },
  { value: 'pencil', labelKey: 'brush.pencil', width: 2 },
  { value: 'highlighter', labelKey: 'brush.highlighter', width: 6 },
];
const STROKE_PATTERNS: { value: StrokePattern; labelKey: TranslationKey }[] = [
  { value: 'solid', labelKey: 'pattern.solid' },
  { value: 'dotted', labelKey: 'strokePattern.dotted' },
  { value: 'dashed', labelKey: 'strokePattern.dashed' },
];
const BLEND_MODES: { value: BlendMode; labelKey: TranslationKey }[] = [
  { value: 'normal', labelKey: 'blend.normal' },
  { value: 'multiply', labelKey: 'blend.multiply' },
  { value: 'screen', labelKey: 'blend.screen' },
  { value: 'overlay', labelKey: 'blend.overlay' },
];
const PIN_ICONS: { value: PinIcon; labelKey: TranslationKey }[] = [
  { value: 'dot', labelKey: 'pinIcon.dot' },
  { value: 'ring', labelKey: 'pinIcon.ring' },
  { value: 'flag', labelKey: 'pinIcon.flag' },
  { value: 'star', labelKey: 'pinIcon.star' },
  { value: 'triangle', labelKey: 'pinIcon.triangle' },
  { value: 'square', labelKey: 'pinIcon.square' },
  { value: 'diamond', labelKey: 'pinIcon.diamond' },
  { value: 'cross', labelKey: 'pinIcon.cross' },
  { value: 'target', labelKey: 'pinIcon.target' },
];
const LEGEND_SYMBOL_KINDS: { value: LegendSymbol['kind']; labelKey: TranslationKey }[] = [
  { value: 'fill', labelKey: 'legendSymbol.fill' },
  { value: 'line', labelKey: 'legendSymbol.line' },
  { value: 'arrow', labelKey: 'legendSymbol.arrow' },
  { value: 'measurement', labelKey: 'legendSymbol.measurement' },
  { value: 'pin', labelKey: 'legendSymbol.pin' },
  { value: 'circle', labelKey: 'legendSymbol.circle' },
];

const ANNOTATION_KIND_LABELS: Record<AnnotationKind, TranslationKey> = {
  text: 'tool.text',
  rectangle: 'tool.rectangle',
  ellipse: 'tool.ellipse',
  line: 'annotation.line',
  arrow: 'annotation.arrow',
  polygon: 'annotation.polygon',
  pin: 'tool.pin',
  measurement: 'annotation.measurement',
  image: 'annotation.image',
  legend: 'annotation.legend',
  comment: 'annotation.comment',
  titleblock: 'annotation.titleBlock',
  sourcecredit: 'annotation.sourceCredit',
  scalebar: 'annotation.scaleBar',
  northarrow: 'annotation.northArrow',
  graticule: 'annotation.graticule',
};

const DEFAULT_ANNOTATION_NAMES: Record<AnnotationKind, string> = {
  text: 'Text',
  // Localized factory output can match these too; this keeps generated names
  // display-localized without touching explicit user renames.
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  arrow: 'Arrow',
  polygon: 'Polygon',
  pin: 'Pin',
  measurement: 'Measurement',
  image: 'Image',
  legend: 'Legend',
  comment: 'Comment',
  titleblock: 'Title block',
  sourcecredit: 'Source credit',
  scalebar: 'Scale bar',
  northarrow: 'North arrow',
  graticule: 'Graticule',
};

function kindLabel(kind: AnnotationKind, t: ReturnType<typeof useLocale.getState>['t']): string {
  return t(ANNOTATION_KIND_LABELS[kind]);
}

function annotationDisplayName(annotation: Annotation, t: ReturnType<typeof useLocale.getState>['t']): string {
  const localizedDefault = kindLabel(annotation.kind, t);
  return annotation.name === DEFAULT_ANNOTATION_NAMES[annotation.kind] || annotation.name === localizedDefault
    ? kindLabel(annotation.kind, t)
    : annotation.name;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[12px] text-[var(--text-2)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[var(--divider)] bg-[var(--glass-thin)] px-3 py-2 text-[11.5px] text-[var(--text-3)]">
      {children}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)] ${className ?? ''}`}
    />
  );
}

function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)] ${className ?? ''}`}
    />
  );
}

function AnchorControl({
  value,
  onChange,
}: {
  value: AnnotationAnchorMode;
  onChange: (mode: AnnotationAnchorMode) => void;
}) {
  const t = useLocale((s) => s.t);
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[8px] bg-[var(--glass-thin)] p-1">
      {(['canvas', 'map'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded-[6px] px-2 py-1.5 text-[11.5px] ${
            value === mode ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'text-[var(--text-2)]'
          }`}
        >
          {mode === 'canvas' ? t('annotation.pinToCanvas') : t('annotation.pinToMap')}
        </button>
      ))}
    </div>
  );
}

function FillControls({
  style,
  sampleTargetAnnotationId,
  onChange,
}: {
  style: AnnotationStyle;
  sampleTargetAnnotationId?: string;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  const t = useLocale((s) => s.t);
  const pendingAnnotationFillSample = useUiStore((s) => s.pendingAnnotationFillSample);
  const startAnnotationFillSample = useUiStore((s) => s.startAnnotationFillSample);
  const cancelAnnotationFillSample = useUiStore((s) => s.cancelAnnotationFillSample);
  const picking =
    sampleTargetAnnotationId !== undefined &&
    pendingAnnotationFillSample?.annotationId === sampleTargetAnnotationId;
  return (
    <Section title={t('annotation.fill')}>
      <div className="grid grid-cols-[1fr_28px] items-center gap-1.5">
        <Swatches value={style.fillColor} onChange={(fillColor) => onChange({ fillColor })} />
        <button
          type="button"
          onClick={() => {
            if (!sampleTargetAnnotationId) return;
            if (picking) cancelAnnotationFillSample();
            else startAnnotationFillSample(sampleTargetAnnotationId);
          }}
          disabled={!sampleTargetAnnotationId}
          aria-label={t('annotation.pickFill')}
          aria-pressed={picking}
          title={t('annotation.pickFill')}
          className={`flex h-7 w-7 items-center justify-center rounded-[7px] border border-[var(--divider)] hover:bg-[var(--hover)] disabled:opacity-40 ${
            picking ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
          }`}
        >
          <Pipette size={13} />
        </button>
      </div>
      <Row label={t('annotation.hatch')}>
        <Select
          value={style.fillPattern}
          onChange={(e) => onChange({ fillPattern: e.target.value as FillPattern })}
        >
          {FILL_PATTERNS.map((pattern) => (
            <option key={pattern.value} value={pattern.value}>
              {t(pattern.labelKey)}
            </option>
          ))}
        </Select>
      </Row>
      {style.fillPattern !== 'none' && (
        <>
          <Row label={t('annotation.hatchColor')}>
            <Swatches value={style.hatchColor} onChange={(hatchColor) => onChange({ hatchColor })} />
          </Row>
          <Row label={t('annotation.density')}>
            <Input
              type="number"
              min={4}
              max={40}
              value={style.hatchSpacing}
              onChange={(e) => onChange({ hatchSpacing: Number(e.target.value) })}
            />
          </Row>
        </>
      )}
    </Section>
  );
}

function StrokeControls({
  style,
  onChange,
}: {
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  const t = useLocale((s) => s.t);
  return (
    <Section title={t('annotation.stroke')}>
      <Row label={t('annotation.color')}>
        <Swatches value={style.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} />
      </Row>
      <Row label={t('annotation.width')}>
        <Input
          type="number"
          min={0}
          max={16}
          value={style.strokeWidth}
          onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
        />
      </Row>
      <Row label={t('annotation.pattern')}>
        <Select
          value={style.strokePattern}
          onChange={(e) => onChange({ strokePattern: e.target.value as StrokePattern })}
        >
          {STROKE_PATTERNS.map((pattern) => (
            <option key={pattern.value} value={pattern.value}>
              {t(pattern.labelKey)}
            </option>
          ))}
        </Select>
      </Row>
    </Section>
  );
}

function TextStyleControls({
  style,
  onChange,
}: {
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  const t = useLocale((s) => s.t);
  return (
    <Section title={t('annotation.text')}>
      <Row label={t('annotation.font')}>
        <Select value={style.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>
          {FONTS.map((font) => (
            <option key={font}>{font}</option>
          ))}
        </Select>
      </Row>
      <Row label={t('annotation.size')}>
        <Input
          type="number"
          min={8}
          max={96}
          value={style.textSize}
          onChange={(e) => onChange({ textSize: Number(e.target.value) })}
        />
      </Row>
      <Row label={t('annotation.color')}>
        <Swatches value={style.textColor} onChange={(textColor) => onChange({ textColor })} />
      </Row>
    </Section>
  );
}

function PinStyleControls({
  style,
  onChange,
}: {
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  const t = useLocale((s) => s.t);
  return (
    <Section title={t('annotation.pin')}>
      <Row label={t('annotation.color')}>
        <Swatches value={style.pinColor} onChange={(pinColor) => onChange({ pinColor })} />
      </Row>
      <Row label={t('annotation.icon')}>
        <Select
          value={style.pinIcon}
          onChange={(e) => onChange({ pinIcon: e.target.value as PinIcon })}
        >
          {PIN_ICONS.map((icon) => (
            <option key={icon.value} value={icon.value}>
              {t(icon.labelKey)}
            </option>
          ))}
        </Select>
      </Row>
    </Section>
  );
}

function CommentStyleControls({
  style,
  onChange,
}: {
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  const t = useLocale((s) => s.t);
  return (
    <Section title={t('annotation.commentMarker')}>
      <Row label={t('annotation.color')}>
        <Swatches value={style.pinColor} onChange={(pinColor) => onChange({ pinColor })} />
      </Row>
    </Section>
  );
}

function EffectsControls({
  style,
  onChange,
}: {
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  const t = useLocale((s) => s.t);
  const haloOn = style.haloWidth > 0;
  const shadowOn = style.shadowBlur > 0 || style.shadowOffsetX !== 0 || style.shadowOffsetY !== 0;
  const [open, setOpen] = useState(haloOn || shadowOn || style.blendMode !== 'normal');
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)] transition-colors hover:text-[var(--text-2)]"
      >
        <span>{t('annotation.effects')}</span>
        <span className="text-[12px]">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          <Row label={t('annotation.halo')}>
            <Input
              type="number"
              min={0}
              max={32}
              value={style.haloWidth}
              onChange={(e) => onChange({ haloWidth: Math.max(0, Number(e.target.value)) })}
            />
          </Row>
          {style.haloWidth > 0 && (
            <Row label={t('annotation.haloColor')}>
              <Swatches value={style.haloColor} onChange={(haloColor) => onChange({ haloColor })} />
            </Row>
          )}
          <Row label={t('annotation.shadow')}>
            <Input
              type="number"
              min={0}
              max={48}
              value={style.shadowBlur}
              onChange={(e) => onChange({ shadowBlur: Math.max(0, Number(e.target.value)) })}
            />
          </Row>
          {shadowOn && (
            <>
              <Row label={t('annotation.shadowColor')}>
                <Swatches value={style.shadowColor} onChange={(shadowColor) => onChange({ shadowColor })} />
              </Row>
              <Row label={t('annotation.offsetX')}>
                <Input
                  type="number"
                  min={-32}
                  max={32}
                  value={style.shadowOffsetX}
                  onChange={(e) => onChange({ shadowOffsetX: Number(e.target.value) })}
                />
              </Row>
              <Row label={t('annotation.offsetY')}>
                <Input
                  type="number"
                  min={-32}
                  max={32}
                  value={style.shadowOffsetY}
                  onChange={(e) => onChange({ shadowOffsetY: Number(e.target.value) })}
                />
              </Row>
            </>
          )}
          <Row label={t('annotation.blend')}>
            <Select
              value={style.blendMode}
              onChange={(e) => onChange({ blendMode: e.target.value as BlendMode })}
            >
              {BLEND_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {t(mode.labelKey)}
                </option>
              ))}
            </Select>
          </Row>
        </div>
      )}
    </section>
  );
}

function StyleControls({
  kind,
  style,
  sampleTargetAnnotationId,
  onChange,
}: {
  kind: AnnotationKind;
  style: AnnotationStyle;
  sampleTargetAnnotationId?: string;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  switch (kind) {
    case 'text':
      return (
        <>
          <TextStyleControls style={style} onChange={onChange} />
          <EffectsControls style={style} onChange={onChange} />
        </>
      );
    case 'line':
    case 'arrow':
    case 'measurement':
      return (
        <>
          <StrokeControls style={style} onChange={onChange} />
          <EffectsControls style={style} onChange={onChange} />
        </>
      );
    case 'pin':
      return (
        <>
          <PinStyleControls style={style} onChange={onChange} />
          <TextStyleControls style={style} onChange={onChange} />
          <EffectsControls style={style} onChange={onChange} />
        </>
      );
    case 'rectangle':
    case 'ellipse':
    case 'polygon':
      return (
        <>
          <FillControls
            style={style}
            sampleTargetAnnotationId={sampleTargetAnnotationId}
            onChange={onChange}
          />
          <StrokeControls style={style} onChange={onChange} />
          <EffectsControls style={style} onChange={onChange} />
        </>
      );
    case 'image':
      return <EffectsControls style={style} onChange={onChange} />;
    case 'legend':
      return (
        <>
          <FillControls
            style={style}
            sampleTargetAnnotationId={sampleTargetAnnotationId}
            onChange={onChange}
          />
          <StrokeControls style={style} onChange={onChange} />
          <TextStyleControls style={style} onChange={onChange} />
          <EffectsControls style={style} onChange={onChange} />
        </>
      );
    case 'comment':
      return (
        <>
          <CommentStyleControls style={style} onChange={onChange} />
          <EffectsControls style={style} onChange={onChange} />
        </>
      );
  }
}

function BrushPresetControls({
  style,
  onChange,
}: {
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  const t = useLocale((s) => s.t);
  return (
    <Section title={t('annotation.brush')}>
      <Row label={t('annotation.preset')}>
        <Select
          value={style.brushPreset ?? 'round'}
          onChange={(e) => {
            const preset = BRUSH_PRESETS.find((item) => item.value === e.target.value);
            if (!preset) return;
            onChange({ brushPreset: preset.value, strokeWidth: preset.width });
          }}
        >
          {BRUSH_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {t(preset.labelKey)}
            </option>
          ))}
        </Select>
      </Row>
    </Section>
  );
}

function GeometryControls({
  annotation,
  disabled,
  onChange,
}: {
  annotation: Annotation;
  disabled: boolean;
  onChange: (patch: Partial<Annotation>) => void;
}) {
  const t = useLocale((s) => s.t);
  switch (annotation.kind) {
    case 'text':
      return (
        <Section title={t('annotation.textBox')}>
          <Row label={t('annotation.text')}>
            <Input
              value={annotation.text}
              disabled={disabled}
              onChange={(e) => onChange({ text: e.target.value } as Partial<Annotation>)}
            />
          </Row>
          <Row label={t('annotation.width')}>
            <Input
              type="number"
              min={24}
              value={annotation.width}
              disabled={disabled}
              onChange={(e) => onChange({ width: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
        </Section>
      );
    case 'rectangle':
      return (
        <Section title={t('tool.rectangle')}>
          <Row label={t('annotation.width')}>
            <Input
              type="number"
              min={4}
              value={annotation.width}
              disabled={disabled}
              onChange={(e) => onChange({ width: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Row label={t('annotation.height')}>
            <Input
              type="number"
              min={4}
              value={annotation.height}
              disabled={disabled}
              onChange={(e) => onChange({ height: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Row label={t('annotation.radius')}>
            <Input
              type="number"
              min={0}
              value={annotation.cornerRadius}
              disabled={disabled}
              onChange={(e) => onChange({ cornerRadius: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
        </Section>
      );
    case 'ellipse':
      return (
        <Section title={t('tool.ellipse')}>
          <Row label={t('annotation.radiusX')}>
            <Input
              type="number"
              min={2}
              value={annotation.radiusX}
              disabled={disabled}
              onChange={(e) => onChange({ radiusX: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Row label={t('annotation.radiusY')}>
            <Input
              type="number"
              min={2}
              value={annotation.radiusY}
              disabled={disabled}
              onChange={(e) => onChange({ radiusY: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
        </Section>
      );
    case 'pin':
      return (
        <Section title={t('annotation.marker')}>
          <Row label={t('annotation.label')}>
            <Input
              value={annotation.label}
              disabled={disabled}
              onChange={(e) => onChange({ label: e.target.value } as Partial<Annotation>)}
            />
          </Row>
          <Row label={t('annotation.size')}>
            <Input
              type="number"
              min={8}
              max={96}
              value={annotation.size}
              disabled={disabled}
              onChange={(e) => onChange({ size: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
        </Section>
      );
    case 'line':
    case 'arrow':
      return (
        <Section title={annotation.kind === 'arrow' ? t('annotation.arrow') : t('annotation.line')}>
          <Hint>{t('annotation.dragEndpointsHint')}</Hint>
        </Section>
      );
    case 'measurement':
      return (
        <Section title={t('annotation.measurement')}>
          <Row label={t('annotation.units')}>
            <Select
              value={annotation.unitSystem}
              disabled={disabled}
              onChange={(e) =>
                onChange({ unitSystem: e.target.value as 'metric' | 'imperial' } as Partial<Annotation>)
              }
            >
              <option value="metric">{t('unit.metric')}</option>
              <option value="imperial">{t('unit.imperial')}</option>
            </Select>
          </Row>
          <Hint>{t('annotation.rulerHint')}</Hint>
        </Section>
      );
    case 'polygon':
      return (
        <Section title={t('annotation.polygon')}>
          <Hint>{t('annotation.polygonHint')}</Hint>
        </Section>
      );
    case 'image':
      return (
        <Section title={t('annotation.image')}>
          <Row label={t('annotation.width')}>
            <Input
              type="number"
              min={8}
              value={annotation.width}
              disabled={disabled}
              onChange={(e) => onChange({ width: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Row label={t('annotation.height')}>
            <Input
              type="number"
              min={8}
              value={annotation.height}
              disabled={disabled}
              onChange={(e) => onChange({ height: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Hint>{t('annotation.imageHint')}</Hint>
        </Section>
      );
    case 'legend':
      return <LegendEntriesEditor annotation={annotation} disabled={disabled} onChange={onChange} />;
    case 'comment':
      return (
        <Section title={t('annotation.comment')}>
          <Row label={t('annotation.text')}>
            <textarea
              value={annotation.text}
              disabled={disabled}
              onChange={(e) => onChange({ text: e.target.value } as Partial<Annotation>)}
              className="min-w-0 h-20 resize-none rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
            />
          </Row>
          <Hint>{t('annotation.commentHint')}</Hint>
        </Section>
      );
    case 'titleblock':
      return (
        <Section title={t('annotation.titleBlock')}>
          <Row label={t('annotation.title')}>
            <Input
              value={annotation.title}
              disabled={disabled}
              onChange={(e) => onChange({ title: e.target.value } as Partial<Annotation>)}
            />
          </Row>
          <Row label={t('annotation.subtitle')}>
            <Input
              value={annotation.subtitle}
              disabled={disabled}
              onChange={(e) => onChange({ subtitle: e.target.value } as Partial<Annotation>)}
            />
          </Row>
        </Section>
      );
    case 'sourcecredit':
      return (
        <Section title={t('annotation.sourceCredit')}>
          <Row label={t('annotation.text')}>
            <Input
              value={annotation.text}
              disabled={disabled}
              onChange={(e) => onChange({ text: e.target.value } as Partial<Annotation>)}
            />
          </Row>
        </Section>
      );
    case 'scalebar':
      return (
        <Section title={t('annotation.scaleBar')}>
          <Row label={t('annotation.units')}>
            <Select
              value={annotation.unitSystem}
              disabled={disabled}
              onChange={(e) =>
                onChange({ unitSystem: e.target.value as 'metric' | 'imperial' } as Partial<Annotation>)
              }
            >
              <option value="metric">{t('unit.metric')}</option>
              <option value="imperial">{t('unit.imperial')}</option>
            </Select>
          </Row>
          <Row label={t('annotation.maxWidth')}>
            <Input
              type="number"
              min={40}
              max={400}
              value={annotation.maxWidth}
              disabled={disabled}
              onChange={(e) => onChange({ maxWidth: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Hint>{t('annotation.scaleBarHint')}</Hint>
        </Section>
      );
    case 'northarrow':
      return (
        <Section title={t('annotation.northArrow')}>
          <Row label={t('annotation.size')}>
            <Input
              type="number"
              min={16}
              max={160}
              value={annotation.size}
              disabled={disabled}
              onChange={(e) => onChange({ size: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Hint>{t('annotation.northArrowHint')}</Hint>
        </Section>
      );
    case 'graticule':
      return (
        <Section title={t('annotation.graticule')}>
          <Row label={t('annotation.intervalDeg')}>
            <Input
              type="number"
              min={1}
              max={90}
              value={annotation.intervalDeg}
              disabled={disabled}
              onChange={(e) => onChange({ intervalDeg: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Hint>{t('annotation.graticuleHint')}</Hint>
        </Section>
      );
  }
}

function legendEntryPatchFromSymbol(symbol: LegendSymbol): Partial<LegendEntry> {
  if (symbol.kind !== 'fill') return { symbol };
  const fillStyle = {
    fillColor: symbol.fillColor,
    fillPattern: symbol.fillPattern,
    hatchColor: symbol.hatchColor,
    hatchSpacing: symbol.hatchSpacing,
  };
  return {
    symbol,
    swatchColor: symbol.fillColor,
    fillStyle,
  };
}

function legendSymbolColor(symbol: LegendSymbol): string {
  if (symbol.kind === 'fill') return symbol.fillColor;
  if (symbol.kind === 'pin') return symbol.pinColor;
  if (symbol.kind === 'circle') return symbol.color;
  return symbol.strokeColor;
}

function convertLegendSymbol(symbol: LegendSymbol, kind: LegendSymbol['kind']): LegendSymbol {
  const color = legendSymbolColor(symbol);
  switch (kind) {
    case 'fill':
      return {
        kind,
        fillColor: color,
        fillPattern: 'none',
        hatchColor: DEFAULT_ANNOTATION_STYLE.hatchColor,
        hatchSpacing: DEFAULT_ANNOTATION_STYLE.hatchSpacing,
      };
    case 'line':
    case 'arrow':
    case 'measurement':
      return {
        kind,
        strokeColor: color,
        strokeWidth: symbol.kind === 'line' || symbol.kind === 'arrow' || symbol.kind === 'measurement'
          ? symbol.strokeWidth
          : DEFAULT_ANNOTATION_STYLE.strokeWidth,
        strokePattern: symbol.kind === 'line' || symbol.kind === 'arrow' || symbol.kind === 'measurement'
          ? symbol.strokePattern
          : DEFAULT_ANNOTATION_STYLE.strokePattern,
        brushPreset: kind === 'line'
          ? symbol.kind === 'line'
            ? symbol.brushPreset ?? DEFAULT_ANNOTATION_STYLE.brushPreset
            : DEFAULT_ANNOTATION_STYLE.brushPreset
          : undefined,
      };
    case 'pin':
      return {
        kind,
        pinColor: color,
        pinIcon: symbol.kind === 'pin' ? symbol.pinIcon : DEFAULT_ANNOTATION_STYLE.pinIcon,
      };
    case 'circle':
      return {
        kind,
        color,
        radius: symbol.kind === 'circle' ? symbol.radius : 8,
        maxRadius: symbol.kind === 'circle' ? symbol.maxRadius : 16,
      };
  }
}

function LegendSymbolPreview({ symbol }: { symbol: LegendSymbol }) {
  if (symbol.kind === 'fill') {
    const fill = {
      fillColor: symbol.fillColor,
      fillPattern: symbol.fillPattern,
      hatchColor: symbol.hatchColor,
      hatchSpacing: symbol.hatchSpacing,
    };
    return (
      <span
        className="block h-full w-full rounded-[5px]"
        style={{
          background: legendSwatchBackground(fill),
          backgroundSize: legendSwatchBackgroundSize(fill),
        }}
      />
    );
  }

  if (symbol.kind === 'pin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full">
        <circle cx="12" cy="12" r="7" fill={symbol.pinIcon === 'ring' ? 'transparent' : symbol.pinColor} stroke={symbol.pinColor} strokeWidth={symbol.pinIcon === 'ring' ? 3 : 1.5} />
        {symbol.pinIcon === 'target' && <circle cx="12" cy="12" r="3.5" fill="none" stroke="#ffffff" strokeWidth="1.5" />}
        {symbol.pinIcon === 'cross' && (
          <>
            <path d="M8 12h8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 8v8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </svg>
    );
  }

  if (symbol.kind === 'circle') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full">
        <circle cx="12" cy="12" r={Math.max(2.5, 9 * (symbol.radius / Math.max(1, symbol.maxRadius)))} fill={symbol.color} stroke="#ffffff" strokeWidth="1" />
      </svg>
    );
  }

  const dash = symbol.strokePattern === 'dashed' ? '5 4' : symbol.strokePattern === 'dotted' ? '1 4' : undefined;
  return (
    <svg viewBox="0 0 32 24" aria-hidden="true" className="h-full w-full">
      <path
        d="M4 12H26"
        fill="none"
        stroke={symbol.strokeColor}
        strokeWidth={Math.min(5, Math.max(1.5, symbol.strokeWidth))}
        strokeLinecap="round"
        strokeDasharray={dash}
      />
      {symbol.kind === 'arrow' && <path d="M22 7l6 5-6 5z" fill={symbol.strokeColor} />}
      {symbol.kind === 'measurement' && (
        <>
          <circle cx="4" cy="12" r="2.5" fill="#ffffff" stroke={symbol.strokeColor} strokeWidth="1.5" />
          <circle cx="26" cy="12" r="2.5" fill="#ffffff" stroke={symbol.strokeColor} strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

function MiniField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function LegendEntryRow({
  entry,
  index,
  disabled,
  legendId,
  onUpdate,
  onRemove,
}: {
  entry: LegendEntry;
  index: number;
  disabled: boolean;
  legendId: string;
  onUpdate: (patch: Partial<LegendEntry>) => void;
  onRemove: () => void;
}) {
  const t = useLocale((s) => s.t);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const pendingLegendFillSample = useUiStore((s) => s.pendingLegendFillSample);
  const startLegendFillSample = useUiStore((s) => s.startLegendFillSample);
  const cancelLegendFillSample = useUiStore((s) => s.cancelLegendFillSample);
  const picking =
    pendingLegendFillSample?.legendId === legendId &&
    pendingLegendFillSample.entryIndex === index;
  const symbol = legendEntrySymbol(entry);
  const color = legendSymbolColor(symbol);
  const isStrokeSymbol = symbol.kind === 'line' || symbol.kind === 'arrow' || symbol.kind === 'measurement';
  const updateSymbol = (next: LegendSymbol) => onUpdate(legendEntryPatchFromSymbol(next));
  const updateSymbolColor = (hex: string) => {
    if (symbol.kind === 'fill') {
      updateSymbol({ ...symbol, fillColor: hex, fillPattern: 'none' });
      return;
    }
    if (symbol.kind === 'pin') {
      updateSymbol({ ...symbol, pinColor: hex });
      return;
    }
    if (symbol.kind === 'circle') {
      updateSymbol({ ...symbol, color: hex });
      return;
    }
    updateSymbol({ ...symbol, strokeColor: hex });
  };
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--divider)] bg-[var(--glass-thin)] p-2.5">
      <div className="flex items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t('annotation.ariaEntryColor', { n: index + 1 })}
          className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] border border-[var(--divider)] bg-[var(--glass-thin)] p-1 transition-transform hover:scale-105"
        >
          <LegendSymbolPreview symbol={symbol} />
        </button>
        <Input
          value={entry.label}
          disabled={disabled}
          aria-label={t('annotation.ariaEntryLabel', { n: index + 1 })}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="h-[30px] flex-1 py-0"
        />
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => {
              if (picking) cancelLegendFillSample();
              else startLegendFillSample(legendId, index);
            }}
            disabled={disabled}
            aria-label={t('annotation.ariaSampleEntrySymbol', { n: index + 1 })}
            aria-pressed={picking}
            title={t('annotation.pickLegendSymbol')}
            className={`flex h-[28px] w-[28px] items-center justify-center rounded-[7px] hover:bg-[var(--hover)] disabled:opacity-40 ${
              picking ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
            }`}
          >
            <Pipette size={13} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={t('annotation.ariaRemoveEntry', { n: index + 1 })}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-[var(--text-3)] hover:bg-[var(--hover)] hover:text-[var(--text-2)] disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <ColorPickerPopover
        open={open}
        anchorRef={buttonRef}
        value={color}
        onChange={updateSymbolColor}
        onClose={() => setOpen(false)}
      />

      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
        <MiniField
          label={t('annotation.type')}
          className={isStrokeSymbol || symbol.kind === 'pin' ? undefined : 'col-span-2'}
        >
          <Select
            value={symbol.kind}
            disabled={disabled}
            aria-label={t('annotation.legendSymbolType')}
            onChange={(e) => updateSymbol(convertLegendSymbol(symbol, e.target.value as LegendSymbol['kind']))}
          >
            {LEGEND_SYMBOL_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {t(kind.labelKey)}
              </option>
            ))}
          </Select>
        </MiniField>

        {isStrokeSymbol && (
          <MiniField label={t('annotation.width')}>
            <Input
              type="number"
              min={1}
              max={16}
              value={symbol.strokeWidth}
              disabled={disabled}
              aria-label={t('annotation.width')}
              onChange={(e) => updateSymbol({ ...symbol, strokeWidth: Number(e.target.value) })}
            />
          </MiniField>
        )}

        {isStrokeSymbol && (
          <MiniField
            label={t('annotation.pattern')}
            className={symbol.kind === 'line' ? undefined : 'col-span-2'}
          >
            <Select
              value={symbol.strokePattern}
              disabled={disabled}
              aria-label={t('annotation.pattern')}
              onChange={(e) => updateSymbol({ ...symbol, strokePattern: e.target.value as StrokePattern })}
            >
              {STROKE_PATTERNS.map((pattern) => (
                <option key={pattern.value} value={pattern.value}>
                  {t(pattern.labelKey)}
                </option>
              ))}
            </Select>
          </MiniField>
        )}

        {symbol.kind === 'line' && (
          <MiniField label={t('annotation.preset')}>
            <Select
              value={symbol.brushPreset ?? DEFAULT_ANNOTATION_STYLE.brushPreset}
              disabled={disabled}
              aria-label={t('annotation.preset')}
              onChange={(e) => updateSymbol({ ...symbol, brushPreset: e.target.value as BrushPreset })}
            >
              {BRUSH_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {t(preset.labelKey)}
                </option>
              ))}
            </Select>
          </MiniField>
        )}

        {symbol.kind === 'pin' && (
          <MiniField label={t('annotation.icon')}>
            <Select
              value={symbol.pinIcon}
              disabled={disabled}
              aria-label={t('annotation.icon')}
              onChange={(e) => updateSymbol({ ...symbol, pinIcon: e.target.value as PinIcon })}
            >
              {PIN_ICONS.map((icon) => (
                <option key={icon.value} value={icon.value}>
                  {t(icon.labelKey)}
                </option>
              ))}
            </Select>
          </MiniField>
        )}
      </div>
    </div>
  );
}

function LegendEntriesEditor({
  annotation,
  disabled,
  onChange,
}: {
  annotation: LegendAnnotation;
  disabled: boolean;
  onChange: (patch: Partial<Annotation>) => void;
}) {
  const t = useLocale((s) => s.t);
  const layers = useDocumentStore((s) => s.project.layers);
  const setEntries = (next: LegendEntry[]) =>
    onChange({ entries: next } as Partial<Annotation>);

  const updateEntry = (index: number, patch: Partial<LegendEntry>) => {
    const next = annotation.entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    setEntries(next);
  };
  const removeEntry = (index: number) => setEntries(annotation.entries.filter((_, i) => i !== index));
  const addEntry = () =>
    setEntries([
      ...annotation.entries,
      {
        label: t('annotation.newEntry'),
        swatchColor: '#34c759',
        symbol: { kind: 'fill', fillColor: '#34c759', fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
        fillStyle: { fillColor: '#34c759', fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
        visible: true,
      },
    ]);
  const syncFromLayers = () =>
    setEntries(
      layers.map((layer) => ({
        label: layer.name,
        swatchColor: layer.style.fillColor,
        symbol: {
          kind: 'fill',
          fillColor: layer.style.fillColor,
          fillPattern: layer.style.fillPattern,
          hatchColor: layer.style.hatchColor,
          hatchSpacing: layer.style.hatchSpacing,
        },
        fillStyle: {
          fillColor: layer.style.fillColor,
          fillPattern: layer.style.fillPattern,
          hatchColor: layer.style.hatchColor,
          hatchSpacing: layer.style.hatchSpacing,
        },
        visible: true,
      })),
    );

  return (
    <Section title={t('annotation.legend')}>
      <Row label={t('annotation.title')}>
        <Input
          value={annotation.title}
          disabled={disabled}
          onChange={(e) => onChange({ title: e.target.value } as Partial<Annotation>)}
        />
      </Row>
      <Row label={t('annotation.width')}>
        <Input
          type="number"
          min={80}
          value={annotation.width}
          disabled={disabled}
          onChange={(e) => onChange({ width: Number(e.target.value) } as Partial<Annotation>)}
        />
      </Row>
      <div className="flex flex-col gap-1.5">
        {annotation.entries.map((entry, index) => (
          <LegendEntryRow
            key={index}
            entry={entry}
            index={index}
            disabled={disabled}
            legendId={annotation.id}
            onUpdate={(patch) => updateEntry(index, patch)}
            onRemove={() => removeEntry(index)}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={addEntry}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[11.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
        >
          <Plus size={13} /> {t('annotation.addRow')}
        </button>
        <button
          type="button"
          onClick={syncFromLayers}
          disabled={disabled || layers.length === 0}
          aria-label={t('annotation.syncFromLayers')}
          title={t('annotation.syncFromLayers')}
          className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px] border border-[var(--divider)] bg-[var(--glass-thin)] text-[var(--text-3)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </Section>
  );
}

function ToolDefaults() {
  const t = useLocale((s) => s.t);
  const activeTool = useToolStore((s) => s.activeTool);
  const anchorMode = useToolStore((s) => s.defaultAnchorMode);
  const style = useToolStore((s) => s.defaultStyle);
  const { setDefaultAnchorMode, updateDefaultStyle } = useToolStore.getState();
  const kind = toolToAnnotationKind(activeTool);
  const toolName = t(`tool.${activeTool}`);

  if (!kind) {
    return (
      <div className="flex flex-col gap-3 text-[12px] text-[var(--text-3)]">
        <div className="flex items-center gap-2 text-[var(--text-2)]">
          <MousePointer2 size={16} />
          <span className="font-semibold text-[var(--text)]">{t('annotation.noTool')}</span>
        </div>
        {t('annotation.noToolHelp')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent)]">
          <Palette size={15} />
        </span>
        <div>
          <div className="text-[13px] font-semibold text-[var(--text)]">
            {t('annotation.defaults', { name: toolName })}
          </div>
          <div className="text-[11px] text-[var(--text-3)]">
            {activeTool === 'paint'
              ? t('annotation.defaultsHelpStroke')
              : t('annotation.defaultsHelpObject')}
          </div>
        </div>
      </div>
      <Section title={t('annotation.anchor')}>
        <AnchorControl value={anchorMode} onChange={setDefaultAnchorMode} />
      </Section>
      {activeTool === 'paint' && <BrushPresetControls style={style} onChange={updateDefaultStyle} />}
      <StyleControls kind={kind} style={style} onChange={updateDefaultStyle} />
    </div>
  );
}

function SelectedAnnotation({ annotation }: { annotation: Annotation }) {
  const t = useLocale((s) => s.t);
  const map = useMapInstance((s) => s.map);
  const { updateAnnotation, updateAnnotationStyle } = useDocumentStore.getState();
  const disabled = annotation.locked;

  const setAnchorMode = (mode: AnnotationAnchorMode) => {
    if (mode === annotation.anchorMode) return;
    if (mode === 'map' && map) {
      const lngLat = map.unproject([annotation.position.x, annotation.position.y]);
      updateAnnotation(annotation.id, {
        anchorMode: mode,
        geoAnchor: [lngLat.lng, lngLat.lat],
      } as Partial<Annotation>);
      return;
    }
    if (annotation.anchorMode === 'map' && annotation.geoAnchor && map) {
      const point = map.project(annotation.geoAnchor);
      updateAnnotation(annotation.id, {
        anchorMode: mode,
        position: { x: point.x, y: point.y },
      } as Partial<Annotation>);
      return;
    }
    updateAnnotation(annotation.id, { anchorMode: mode } as Partial<Annotation>);
  };

  return (
    <div className={`flex flex-col gap-4 ${disabled ? 'opacity-65' : ''}`}>
      <div className="rounded-[10px] bg-[var(--accent-soft)] p-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--accent)]">
          {disabled ? <Lock size={15} /> : <MapPinned size={15} />}
          {annotationDisplayName(annotation, t)}
        </div>
        <div className="mt-1 text-[11px] capitalize text-[var(--text-3)]">
          {t('annotation.pinnedTo', {
            kind: kindLabel(annotation.kind, t),
            anchor: annotation.anchorMode === 'canvas' ? t('annotation.pinnedToCanvas') : t('annotation.pinnedToMap'),
          })}
        </div>
      </div>

      <Section title={t('annotation.selection')}>
        <Row label={t('annotation.name')}>
          <Input
            value={annotation.name}
            disabled={disabled}
            onChange={(e) => updateAnnotation(annotation.id, { name: e.target.value } as Partial<Annotation>)}
          />
        </Row>
        <Row label={t('annotation.opacity')}>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={annotation.opacity}
            disabled={disabled}
            onChange={(e) =>
              updateAnnotation(annotation.id, { opacity: Number(e.target.value) } as Partial<Annotation>)
            }
          />
        </Row>
      </Section>

      <GeometryControls
        annotation={annotation}
        disabled={disabled}
        onChange={(patch) => updateAnnotation(annotation.id, patch)}
      />

      <Section title={t('annotation.anchor')}>
        <AnchorControl value={annotation.anchorMode} onChange={setAnchorMode} />
      </Section>

      {annotation.kind === 'line' && annotation.lineRole === 'brush' && (
        <BrushPresetControls
          style={annotation.style}
          onChange={(patch) => updateAnnotationStyle(annotation.id, patch)}
        />
      )}

      <StyleControls
        kind={annotation.kind}
        style={annotation.style}
        sampleTargetAnnotationId={annotation.id}
        onChange={(patch) => updateAnnotationStyle(annotation.id, patch)}
      />
    </div>
  );
}

/** Properties pane for selected annotations or active tool defaults. */
export function AnnotationInspector() {
  const selectedAnnotationId = useDocumentStore((s) => s.selectedAnnotationId);
  const annotation = useDocumentStore((s) =>
    s.project.annotations.find((item) => item.id === selectedAnnotationId),
  );

  if (annotation) return <SelectedAnnotation annotation={annotation} />;
  return <ToolDefaults />;
}
