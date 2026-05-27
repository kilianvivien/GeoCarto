import { useRef, useState } from 'react';
import { Lock, MapPinned, MousePointer2, Palette } from 'lucide-react';
import { ColorPickerPopover } from '@/ui/ColorPickerPopover';
import type {
  Annotation,
  AnnotationAnchorMode,
  AnnotationKind,
  AnnotationStyle,
  FillPattern,
  PinIcon,
  StrokePattern,
} from '@/project/cartoproj';
import { useMapInstance } from '@/canvas/mapInstance';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore, toolToAnnotationKind } from '@/state/toolStore';

const SWATCHES = ['#007aff', '#34c759', '#ff9500', '#ff3b30', '#af52de', '#111827', '#ffffff'];
const FONTS = ['Inter', 'Avenir Next', 'Helvetica Neue', 'Georgia'];
const FILL_PATTERNS: { value: FillPattern; label: string }[] = [
  { value: 'none', label: 'Solid' },
  { value: 'diagonal', label: 'Diagonal hatch' },
  { value: 'crosshatch', label: 'Crosshatch' },
  { value: 'horizontal', label: 'Horizontal hatch' },
  { value: 'vertical', label: 'Vertical hatch' },
  { value: 'dots', label: 'Dot hatch' },
];
const STROKE_PATTERNS: { value: StrokePattern; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'dashed', label: 'Dashed' },
];
const PIN_ICONS: { value: PinIcon; label: string }[] = [
  { value: 'dot', label: 'Dot' },
  { value: 'ring', label: 'Ring' },
  { value: 'flag', label: 'Flag' },
  { value: 'star', label: 'Star' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'square', label: 'Square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'cross', label: 'Cross' },
  { value: 'target', label: 'Target' },
];

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

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
    />
  );
}

function normalizeHex(value: string): string {
  return value.trim().toLowerCase();
}

function Swatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const normalizedValue = normalizeHex(value);
  const isPreset = SWATCHES.some((c) => normalizeHex(c) === normalizedValue);
  return (
    <div className="grid grid-cols-8 gap-1">
      {SWATCHES.map((color) => {
        const selected = normalizeHex(color) === normalizedValue;
        return (
          <button
            key={color}
            type="button"
            aria-label={`Use ${color}`}
            onClick={() => onChange(color)}
            className={`h-6 rounded-[7px] border transition-transform hover:scale-110 ${
              selected ? 'border-[var(--accent)] ring-2 ring-[var(--accent-ring)]' : 'border-[var(--divider)]'
            }`}
            style={{ background: color }}
          />
        );
      })}
      <CustomColorPicker value={value} active={!isPreset} onChange={onChange} />
    </div>
  );
}

function CustomColorPicker({
  value,
  active,
  onChange,
}: {
  value: string;
  active: boolean;
  onChange: (color: string) => void;
}) {
  // Conic rainbow used both as the idle glyph and as a halo behind the current
  // custom color so the picker stays visually distinct from the presets.
  const rainbow =
    'conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #5ac8fa, #007aff, #5856d6, #af52de, #ff2d55, #ff3b30)';
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Pick a custom color"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`relative flex h-6 items-center justify-center rounded-[7px] border transition-transform hover:scale-110 ${
          active ? 'border-[var(--accent)] ring-2 ring-[var(--accent-ring)]' : 'border-[var(--divider)]'
        }`}
        style={{ background: active ? value : rainbow }}
      >
        {active && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0.5 rounded-[5px] border border-white/40"
          />
        )}
      </button>
      <ColorPickerPopover
        open={open}
        anchorRef={buttonRef}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function AnchorControl({
  value,
  onChange,
}: {
  value: AnnotationAnchorMode;
  onChange: (mode: AnnotationAnchorMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[8px] bg-[var(--glass-thin)] p-1">
      {(['canvas', 'map'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded-[6px] px-2 py-1.5 text-[11.5px] capitalize ${
            value === mode ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'text-[var(--text-2)]'
          }`}
        >
          Pin to {mode}
        </button>
      ))}
    </div>
  );
}

function FillControls({
  style,
  onChange,
}: {
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  return (
    <Section title="Fill">
      <Swatches value={style.fillColor} onChange={(fillColor) => onChange({ fillColor })} />
      <Row label="Hatch">
        <Select
          value={style.fillPattern}
          onChange={(e) => onChange({ fillPattern: e.target.value as FillPattern })}
        >
          {FILL_PATTERNS.map((pattern) => (
            <option key={pattern.value} value={pattern.value}>
              {pattern.label}
            </option>
          ))}
        </Select>
      </Row>
      {style.fillPattern !== 'none' && (
        <>
          <Row label="Hatch color">
            <Swatches value={style.hatchColor} onChange={(hatchColor) => onChange({ hatchColor })} />
          </Row>
          <Row label="Density">
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
  return (
    <Section title="Stroke">
      <Row label="Color">
        <Swatches value={style.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} />
      </Row>
      <Row label="Width">
        <Input
          type="number"
          min={0}
          max={16}
          value={style.strokeWidth}
          onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
        />
      </Row>
      <Row label="Pattern">
        <Select
          value={style.strokePattern}
          onChange={(e) => onChange({ strokePattern: e.target.value as StrokePattern })}
        >
          {STROKE_PATTERNS.map((pattern) => (
            <option key={pattern.value} value={pattern.value}>
              {pattern.label}
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
  return (
    <Section title="Text">
      <Row label="Font">
        <Select value={style.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>
          {FONTS.map((font) => (
            <option key={font}>{font}</option>
          ))}
        </Select>
      </Row>
      <Row label="Size">
        <Input
          type="number"
          min={8}
          max={96}
          value={style.textSize}
          onChange={(e) => onChange({ textSize: Number(e.target.value) })}
        />
      </Row>
      <Row label="Color">
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
  return (
    <Section title="Pin">
      <Row label="Color">
        <Swatches value={style.pinColor} onChange={(pinColor) => onChange({ pinColor })} />
      </Row>
      <Row label="Icon">
        <Select
          value={style.pinIcon}
          onChange={(e) => onChange({ pinIcon: e.target.value as PinIcon })}
        >
          {PIN_ICONS.map((icon) => (
            <option key={icon.value} value={icon.value}>
              {icon.label}
            </option>
          ))}
        </Select>
      </Row>
    </Section>
  );
}

function StyleControls({
  kind,
  style,
  onChange,
}: {
  kind: AnnotationKind;
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
}) {
  switch (kind) {
    case 'text':
      return <TextStyleControls style={style} onChange={onChange} />;
    case 'line':
    case 'arrow':
    case 'measurement':
      return <StrokeControls style={style} onChange={onChange} />;
    case 'pin':
      return (
        <>
          <PinStyleControls style={style} onChange={onChange} />
          <TextStyleControls style={style} onChange={onChange} />
        </>
      );
    case 'rectangle':
    case 'ellipse':
    case 'polygon':
      return (
        <>
          <FillControls style={style} onChange={onChange} />
          <StrokeControls style={style} onChange={onChange} />
        </>
      );
  }
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
  switch (annotation.kind) {
    case 'text':
      return (
        <Section title="Text Box">
          <Row label="Text">
            <Input
              value={annotation.text}
              disabled={disabled}
              onChange={(e) => onChange({ text: e.target.value } as Partial<Annotation>)}
            />
          </Row>
          <Row label="Width">
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
        <Section title="Rectangle">
          <Row label="Width">
            <Input
              type="number"
              min={4}
              value={annotation.width}
              disabled={disabled}
              onChange={(e) => onChange({ width: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Row label="Height">
            <Input
              type="number"
              min={4}
              value={annotation.height}
              disabled={disabled}
              onChange={(e) => onChange({ height: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Row label="Radius">
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
        <Section title="Ellipse">
          <Row label="Radius X">
            <Input
              type="number"
              min={2}
              value={annotation.radiusX}
              disabled={disabled}
              onChange={(e) => onChange({ radiusX: Number(e.target.value) } as Partial<Annotation>)}
            />
          </Row>
          <Row label="Radius Y">
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
        <Section title="Marker">
          <Row label="Label">
            <Input
              value={annotation.label}
              disabled={disabled}
              onChange={(e) => onChange({ label: e.target.value } as Partial<Annotation>)}
            />
          </Row>
          <Row label="Size">
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
        <Section title={annotation.kind === 'arrow' ? 'Arrow' : 'Line'}>
          <Hint>Drag the canvas handles to adjust endpoints and length.</Hint>
        </Section>
      );
    case 'measurement':
      return (
        <Section title="Measurement">
          <Row label="Units">
            <Select
              value={annotation.unitSystem}
              disabled={disabled}
              onChange={(e) =>
                onChange({ unitSystem: e.target.value as 'metric' | 'imperial' } as Partial<Annotation>)
              }
            >
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </Select>
          </Row>
          <Hint>Use the ruler tool to place two or more anchored measurement points.</Hint>
        </Section>
      );
    case 'polygon':
      return (
        <Section title="Polygon">
          <Hint>Drag the canvas handles to scale the polygon.</Hint>
        </Section>
      );
  }
}

function ToolDefaults() {
  const activeTool = useToolStore((s) => s.activeTool);
  const anchorMode = useToolStore((s) => s.defaultAnchorMode);
  const style = useToolStore((s) => s.defaultStyle);
  const { setDefaultAnchorMode, updateDefaultStyle } = useToolStore.getState();
  const kind = toolToAnnotationKind(activeTool);

  if (!kind) {
    return (
      <div className="flex flex-col gap-3 text-[12px] text-[var(--text-3)]">
        <div className="flex items-center gap-2 text-[var(--text-2)]">
          <MousePointer2 size={16} />
          <span className="font-semibold text-[var(--text)]">No annotation tool selected</span>
        </div>
        Pick a drawing tool to set annotation defaults, or select an annotation on the canvas.
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
          <div className="text-[13px] font-semibold capitalize text-[var(--text)]">{kind} defaults</div>
          <div className="text-[11px] text-[var(--text-3)]">Applied to the next object you place.</div>
        </div>
      </div>
      <Section title="Anchor">
        <AnchorControl value={anchorMode} onChange={setDefaultAnchorMode} />
      </Section>
      <StyleControls kind={kind} style={style} onChange={updateDefaultStyle} />
    </div>
  );
}

function SelectedAnnotation({ annotation }: { annotation: Annotation }) {
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
          {annotation.name}
        </div>
        <div className="mt-1 text-[11px] capitalize text-[var(--text-3)]">
          {annotation.kind} · pinned to {annotation.anchorMode}
        </div>
      </div>

      <Section title="Selection">
        <Row label="Name">
          <Input
            value={annotation.name}
            disabled={disabled}
            onChange={(e) => updateAnnotation(annotation.id, { name: e.target.value } as Partial<Annotation>)}
          />
        </Row>
        <Row label="Opacity">
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

      <Section title="Anchor">
        <AnchorControl value={annotation.anchorMode} onChange={setAnchorMode} />
      </Section>

      <StyleControls
        kind={annotation.kind}
        style={annotation.style}
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
