import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileJson, Globe2 } from 'lucide-react';
import {
  DEFAULT_BASEMAP_SUBLAYERS,
  type BasemapConfig,
  type BuiltInBasemapPreset,
  type PageBackground,
  type PagePresetKey,
} from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { BasemapSublayerToggles } from '@/basemap/BasemapSublayerToggles';
import { PAGE_PRESETS, PAGE_PRESET_BY_KEY, detectPreset } from '@/export/pagePresets';
import { ColorPickerPopover } from './ColorPickerPopover';

const BUILT_INS: { preset: BuiltInBasemapPreset; name: string; tint: string }[] = [
  { preset: 'editorial-light', name: 'Editorial Light', tint: 'linear-gradient(135deg,#f5f7fa,#dbe3ee 60%,#b9c6d9)' },
  { preset: 'editorial-dark', name: 'Editorial Dark', tint: 'linear-gradient(135deg,#1f2937,#0f172a 60%,#020617)' },
  { preset: 'minimal-grey', name: 'Minimal Grey', tint: 'linear-gradient(135deg,#dcdee2,#a3a8b1 60%,#6b7280)' },
  { preset: 'print-bw', name: 'Print B&W', tint: 'linear-gradient(135deg,#ffffff,#9ca3af 60%,#111827)' },
];

const DPI_PRESETS: { value: number; label: string }[] = [
  { value: 1, label: '1×' },
  { value: 2, label: '2× (≈300 DPI for print sizes)' },
  { value: 3, label: '3×' },
];

function builtinConfig(preset: BuiltInBasemapPreset, name: string): BasemapConfig {
  return {
    kind: 'builtin',
    preset,
    name,
    attribution: 'Protomaps © OpenStreetMap',
    sublayers: { ...DEFAULT_BASEMAP_SUBLAYERS },
  };
}

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)] transition-colors hover:text-[var(--text-2)]"
    >
      <span>{title}</span>
      <ChevronDown
        size={13}
        className={`transition-transform ${open ? '' : '-rotate-90'}`}
        aria-hidden
      />
    </button>
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

function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
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

function BasemapPresetGrid() {
  const basemap = useDocumentStore((s) => s.project.basemap);
  const setBasemap = useDocumentStore((s) => s.setBasemap);
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {BUILT_INS.map((item) => {
        const active = basemap.kind === 'builtin' && basemap.preset === item.preset;
        return (
          <button
            key={item.preset}
            type="button"
            onClick={() => setBasemap(builtinConfig(item.preset, item.name))}
            aria-pressed={active}
            data-testid={`basemap-preset-${item.preset}`}
            className={`relative overflow-hidden rounded-[10px] border px-2 py-3 text-left transition-colors ${
              active
                ? 'border-[var(--accent)] ring-2 ring-[var(--accent-ring)]'
                : 'border-[var(--divider)] hover:border-[var(--text-3)]'
            }`}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{ background: item.tint }}
            />
            <div className="relative text-[11.5px] font-semibold text-[var(--text)] drop-shadow-sm">
              {item.name}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StyleJsonImport() {
  const basemap = useDocumentStore((s) => s.project.basemap);
  const setBasemap = useDocumentStore((s) => s.setBasemap);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (basemap.kind === 'style-json') setDraft(basemap.styleJson);
    else setDraft('');
  }, [basemap]);

  const apply = (rawJson: string, sourceName: string) => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      setError(`Could not parse JSON: ${(err as Error).message}`);
      return;
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as { version?: unknown }).version !== 8 ||
      !Array.isArray((parsed as { layers?: unknown }).layers)
    ) {
      setError('Not a MapLibre style: needs "version": 8 and a "layers" array.');
      return;
    }
    setBasemap({
      kind: 'style-json',
      name: sourceName,
      styleJson: rawJson,
      attribution: 'Custom MapLibre style',
    });
  };

  const onPick = () => fileRef.current?.click();
  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    apply(text, file.name);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onPick}
          className="flex items-center gap-1.5 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--hover)]"
        >
          <FileJson size={13} />
          Import file…
        </button>
        <button
          type="button"
          onClick={() => draft && apply(draft, 'Pasted style')}
          disabled={!draft.trim()}
          className="rounded-[7px] bg-[var(--accent)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-on-accent)] transition-[filter] hover:brightness-105 disabled:opacity-50"
        >
          Apply paste
        </button>
      </div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder='Paste a MapLibre style JSON ({ "version": 8, "sources": …, "layers": … })'
        spellCheck={false}
        className="h-24 resize-y rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        className="hidden"
      />
      {error && (
        <div className="rounded-[7px] border border-[#ff453a]/50 bg-[#ff453a]/10 px-2 py-1.5 text-[11px] text-[#ff453a]">
          {error}
        </div>
      )}
      {basemap.kind === 'style-json' && !error && (
        <div className="text-[11px] text-[var(--text-3)]">
          Using custom style: <span className="text-[var(--text)]">{basemap.name}</span>
        </div>
      )}
    </div>
  );
}

function PageSettings() {
  const exportFrame = useDocumentStore((s) => s.project.exportFrame);
  const {
    setExportFramePreset,
    setExportFrameSize,
    setExportFrameMargin,
    setExportFrameBackground,
    setExportFrameDpiScale,
  } = useDocumentStore.getState();

  const detected = useMemo(
    () => exportFrame.preset ?? detectPreset(exportFrame.width, exportFrame.height),
    [exportFrame.preset, exportFrame.width, exportFrame.height],
  );

  const background = exportFrame.background ?? 'white';
  const dpiScale = exportFrame.dpiScale ?? 1;
  const margin = exportFrame.margin ?? 0;

  // Choose hex when background is neither white nor transparent.
  const customBgRef = useRef<HTMLButtonElement>(null);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const customBgValue =
    background === 'white' || background === 'transparent' ? '#cccccc' : background;
  const bgMode: 'white' | 'transparent' | 'custom' =
    background === 'white' ? 'white' : background === 'transparent' ? 'transparent' : 'custom';

  const applyPreset = (key: PagePresetKey) => {
    if (key === 'custom') {
      setExportFramePreset('custom');
      return;
    }
    const preset = PAGE_PRESET_BY_KEY[key];
    setExportFramePreset(key, { width: preset.width, height: preset.height });
  };

  const swapOrientation = () => {
    setExportFrameSize({ width: exportFrame.height, height: exportFrame.width });
  };

  return (
    <div className="flex flex-col gap-2">
      <Row label="Preset">
        <Select value={detected} onChange={(event) => applyPreset(event.target.value as PagePresetKey)}>
          <optgroup label="Print">
            {PAGE_PRESETS.filter((preset) => preset.family === 'print').map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Screen">
            {PAGE_PRESETS.filter((preset) => preset.family === 'screen').map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </optgroup>
          <option value="custom">Custom…</option>
        </Select>
      </Row>
      <Row label="Width">
        <NumberInput
          min={64}
          value={exportFrame.width}
          onChange={(event) => {
            const next = Math.max(64, Number(event.target.value) || 0);
            setExportFrameSize({ width: next, height: exportFrame.height });
          }}
        />
      </Row>
      <Row label="Height">
        <NumberInput
          min={64}
          value={exportFrame.height}
          onChange={(event) => {
            const next = Math.max(64, Number(event.target.value) || 0);
            setExportFrameSize({ width: exportFrame.width, height: next });
          }}
        />
      </Row>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={swapOrientation}
          className="rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2.5 py-1 text-[11px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          Swap orientation
        </button>
      </div>
      <Row label="Margin (px)">
        <NumberInput
          min={0}
          max={400}
          value={margin}
          onChange={(event) => setExportFrameMargin(Math.max(0, Number(event.target.value) || 0))}
        />
      </Row>
      <Row label="DPI scale">
        <Select
          value={DPI_PRESETS.some((preset) => preset.value === dpiScale) ? String(dpiScale) : 'custom'}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'custom') return;
            setExportFrameDpiScale(Number(value));
          }}
        >
          {DPI_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </Select>
      </Row>
      {!DPI_PRESETS.some((preset) => preset.value === dpiScale) && (
        <Row label="Custom DPI">
          <NumberInput
            min={0.25}
            max={8}
            step={0.25}
            value={dpiScale}
            onChange={(event) =>
              setExportFrameDpiScale(Math.max(0.25, Number(event.target.value) || 1))
            }
          />
        </Row>
      )}
      <div className="grid grid-cols-[88px_1fr] items-start gap-2 text-[12px] text-[var(--text-2)]">
        <span className="pt-1">Background</span>
        <div className="flex flex-wrap items-center gap-1">
          {(['white', 'transparent'] as const).map((mode) => {
            const active = bgMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  mode === 'white'
                    ? setExportFrameBackground('white')
                    : setExportFrameBackground('transparent')
                }
                className={`rounded-[6px] px-2 py-1 text-[11px] capitalize transition-colors ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--text-2)] hover:bg-[var(--hover)]'
                }`}
              >
                {mode}
              </button>
            );
          })}
          <button
            ref={customBgRef}
            type="button"
            onClick={() => setBgPickerOpen((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={bgPickerOpen}
            aria-label="Custom background color"
            className={`relative flex h-6 w-6 items-center justify-center rounded-[6px] border transition-transform hover:scale-105 ${
              bgMode === 'custom'
                ? 'border-[var(--accent)] ring-2 ring-[var(--accent-ring)]'
                : 'border-[var(--divider)]'
            }`}
            style={{
              background:
                bgMode === 'custom'
                  ? customBgValue
                  : 'conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #5ac8fa, #007aff, #5856d6, #af52de, #ff2d55, #ff3b30)',
            }}
          />
          <ColorPickerPopover
            open={bgPickerOpen}
            anchorRef={customBgRef}
            value={customBgValue}
            onChange={(hex) => setExportFrameBackground(hex as PageBackground)}
            onClose={() => setBgPickerOpen(false)}
          />
        </div>
      </div>
      <div className="rounded-[8px] border border-dashed border-[var(--divider)] bg-[var(--glass-thin)] px-2.5 py-1.5 text-[11px] text-[var(--text-3)]">
        Output: {Math.round(exportFrame.width * dpiScale)} × {Math.round(exportFrame.height * dpiScale)} px
      </div>
    </div>
  );
}

/**
 * Document-wide styling. Properties tab handles the *selected* object; this
 * panel handles everything that belongs to the whole project.
 */
export function StylePanel() {
  const [openBasemap, setOpenBasemap] = useState(true);
  const [openSublayers, setOpenSublayers] = useState(true);
  const [openCustomStyle, setOpenCustomStyle] = useState(false);
  const [openPage, setOpenPage] = useState(true);
  const basemap = useDocumentStore((s) => s.project.basemap);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <SectionHeader title="Basemap" open={openBasemap} onToggle={() => setOpenBasemap((prev) => !prev)} />
        {openBasemap && <BasemapPresetGrid />}
      </section>

      {(basemap.kind === 'builtin' || basemap.kind === 'pmtiles-url') && (
        <section className="flex flex-col gap-2">
          <SectionHeader
            title="Sub-layers"
            open={openSublayers}
            onToggle={() => setOpenSublayers((prev) => !prev)}
          />
          {openSublayers && <BasemapSublayerToggles compact />}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionHeader
          title="Custom MapLibre style"
          open={openCustomStyle}
          onToggle={() => setOpenCustomStyle((prev) => !prev)}
        />
        {openCustomStyle && <StyleJsonImport />}
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader title="Page" open={openPage} onToggle={() => setOpenPage((prev) => !prev)} />
        {openPage && <PageSettings />}
      </section>

      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
        <Globe2 size={12} />
        {basemap.name}
      </div>
    </div>
  );
}
