import { useState } from 'react';
import { Check, ChevronDown, FileImage, Globe2, Link2, LockKeyhole, Map } from 'lucide-react';
import type { BasemapConfig, BuiltInBasemapPreset } from '@/project/cartoproj';
import { DEFAULT_BASEMAP_SUBLAYERS } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { useViewportStore } from '@/state/viewportStore';
import { BasemapSublayerToggles } from '@/basemap/BasemapSublayerToggles';
import { useNotices } from '@/ui/notices';
import { useMapInstance } from './mapInstance';
import { frameZoomDelta } from './compositionFrame';

const ASPECT_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '4:3', width: 1600, height: 1200 },
  { label: '3:2', width: 1800, height: 1200 },
  { label: '16:9', width: 1920, height: 1080 },
  { label: '1:1', width: 1500, height: 1500 },
  { label: '3:4', width: 1200, height: 1600 },
];

const BUILT_INS: { preset: BuiltInBasemapPreset; name: string; description: string }[] = [
  { preset: 'editorial-light', name: 'Editorial Light', description: 'Bright OSM-derived map for most outputs.' },
  { preset: 'editorial-dark', name: 'Editorial Dark', description: 'Dark editorial base for contrast-heavy graphics.' },
  { preset: 'minimal-grey', name: 'Minimal Grey', description: 'Quiet grey geography for annotation-heavy maps.' },
  { preset: 'print-bw', name: 'Print B&W', description: 'High-contrast monochrome draft base.' },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function builtinConfig(preset: BuiltInBasemapPreset): BasemapConfig {
  const item = BUILT_INS.find((candidate) => candidate.preset === preset) ?? BUILT_INS[0];
  return {
    kind: 'builtin',
    preset,
    name: item.name,
    attribution: 'Protomaps © OpenStreetMap',
    sublayers: { ...DEFAULT_BASEMAP_SUBLAYERS },
  };
}

const cardBase =
  'rounded-[10px] border border-[var(--divider)] bg-[var(--hover)] transition-colors hover:bg-[var(--active)]';
const cardActive = 'rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)] transition-colors';
const linkButton = 'text-[12px] font-semibold text-[var(--accent)] transition-colors hover:opacity-80';

/** Required first-run composition setup before annotation editing is enabled. */
export function MapSetupPanel() {
  const mode = useDocumentStore((s) => s.project.mode);
  const basemap = useDocumentStore((s) => s.project.basemap);
  const exportFrame = useDocumentStore((s) => s.project.exportFrame);
  const { setBasemap, setExportFrame, lockMapArea } = useDocumentStore.getState();
  const viewport = useViewportStore((s) => s.viewport);
  const push = useNotices((s) => s.push);
  const [styleUrl, setStyleUrl] = useState('');
  const [pmtilesUrl, setPmtilesUrl] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  if (mode !== 'mapSetup') return null;

  /** Apply a basemap and drop into the framing step with an unobstructed canvas. */
  const chooseBasemap = (config: BasemapConfig, notice: string) => {
    setBasemap(config);
    push(notice);
    setCollapsed(true);
  };

  const selectStaticFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');
      if (isPdf) {
        push('PDF basemaps are planned for Phase 2 export hardening.', 'error');
        return;
      }
      if (!isImage) {
        push('Choose a PNG, JPEG, or WebP basemap file.', 'error');
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      chooseBasemap(
        {
          kind: 'static',
          name: file.name,
          mediaType: isPdf ? 'pdf' : 'image',
          mimeType: file.type || (isPdf ? 'application/pdf' : 'image/png'),
          dataUrl,
          attribution: file.name,
        },
        `Using "${file.name}" as a static basemap`,
      );
    });
    input.click();
  };

  const applyStyleUrl = () => {
    const url = styleUrl.trim();
    if (!url) return;
    chooseBasemap(
      { kind: 'style-url', name: 'Custom style', url, attribution: 'Custom MapLibre style' },
      'Custom style URL selected',
    );
  };

  const applyPmtilesUrl = () => {
    const url = pmtilesUrl.trim();
    if (!url) return;
    chooseBasemap(
      {
        kind: 'pmtiles-url',
        name: 'Custom PMTiles',
        url,
        preset: 'editorial-light',
        attribution: 'Custom PMTiles',
        sublayers: { ...DEFAULT_BASEMAP_SUBLAYERS },
      },
      'Custom PMTiles URL selected',
    );
  };

  const selectLocalPmtiles = () => {
    push('Local PMTiles files are Phase 2 because blob URLs cannot survive save/reopen.', 'error');
  };

  /** Zoom the map so the composition box fills the canvas, then lock that view. */
  const handleLock = () => {
    const map = useMapInstance.getState().map;
    let locked = viewport;
    const container = map?.getContainer();
    if (map && container && container.clientWidth > 0 && container.clientHeight > 0) {
      const delta = frameZoomDelta(
        container.clientWidth,
        container.clientHeight,
        exportFrame.width / exportFrame.height,
      );
      locked = { ...viewport, zoom: viewport.zoom + delta };
      map.jumpTo({ center: locked.center, zoom: locked.zoom, bearing: locked.bearing, pitch: locked.pitch });
    }
    lockMapArea(locked);
  };

  const lockButton = (
    <button
      type="button"
      onClick={handleLock}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 text-[12px] font-semibold text-[var(--text-on-accent)] shadow-[0_4px_14px_var(--accent-soft)] transition-transform hover:scale-[1.03] active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <LockKeyhole size={14} />
      Lock Map Area
    </button>
  );

  const transition =
    'transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none';

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-30">
      {/* Full panel — fades/scales out when collapsed. */}
      <div
        inert={collapsed}
        aria-hidden={collapsed}
        className={`flex justify-center ${transition} ${
          collapsed ? 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0' : 'opacity-100'
        }`}
      >
        <div className="glass pointer-events-auto flex max-h-[calc(100vh-7rem)] w-[min(820px,100%)] flex-col gap-3.5 overflow-y-auto bg-[var(--glass-strong)] p-4 text-[var(--text)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--hover)]">
                <Map size={15} className="text-[var(--accent)]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold">Set up map</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-2)]">
                  Choose a basemap, frame the composition area, then lock it before editing.
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {lockButton}
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
                title="Minimize"
                aria-label="Minimize map setup"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            Built-in basemaps
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            {BUILT_INS.map((item) => {
              const active = basemap.kind === 'builtin' && basemap.preset === item.preset;
              return (
                <button
                  key={item.preset}
                  type="button"
                  onClick={() => chooseBasemap(builtinConfig(item.preset), `${item.name} basemap selected`)}
                  className={`${active ? cardActive : cardBase} p-3 text-left`}
                >
                  <div className="flex items-center gap-2 text-[12px] font-semibold">
                    {active ? <Check size={14} className="text-[var(--accent)]" /> : <Globe2 size={14} />}
                    {item.name}
                  </div>
                  <div className="mt-2 text-[11px] leading-snug text-[var(--text-2)]">{item.description}</div>
                </button>
              );
            })}
          </div>

          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            Custom source
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className={`${cardBase} p-3`}>
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold">
                <Link2 size={14} />
                Style JSON URL
              </div>
              <input
                value={styleUrl}
                onChange={(e) => setStyleUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyStyleUrl()}
                placeholder="https://…/style.json"
                className="mb-2 w-full rounded-[7px] border border-[var(--divider)] bg-[var(--hover)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
              />
              <button type="button" onClick={applyStyleUrl} className={linkButton}>
                Use style URL
              </button>
            </div>

            <div className={`${cardBase} p-3`}>
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold">
                <Globe2 size={14} />
                PMTiles URL
              </div>
              <input
                value={pmtilesUrl}
                onChange={(e) => setPmtilesUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyPmtilesUrl()}
                placeholder="https://…/region.pmtiles"
                className="mb-2 w-full rounded-[7px] border border-[var(--divider)] bg-[var(--hover)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
              />
              <button type="button" onClick={applyPmtilesUrl} className={linkButton}>
                Use PMTiles
              </button>
              <span className="mx-2 text-[var(--text-3)]">·</span>
              <button
                type="button"
                onClick={selectLocalPmtiles}
                disabled
                title="Phase 2: local PMTiles file persistence"
                className={`${linkButton} disabled:cursor-not-allowed disabled:opacity-45`}
              >
                File in Phase 2
              </button>
            </div>

            <button
              type="button"
              onClick={selectStaticFile}
              className={`${basemap.kind === 'static' ? cardActive : cardBase} p-3 text-left`}
            >
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold">
                <FileImage size={14} />
                Image or PDF
              </div>
              <div className="text-[11px] leading-snug text-[var(--text-2)]">
                Use a PNG, JPEG, or WebP as a visual static basemap.
              </div>
            </button>
          </div>

          {(basemap.kind === 'builtin' || basemap.kind === 'pmtiles-url') && (
            <>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Basemap sub-layers
              </div>
              <BasemapSublayerToggles />
            </>
          )}

          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            Composition frame
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_PRESETS.map((preset) => {
              const active = exportFrame.width === preset.width && exportFrame.height === preset.height;
              const ratio = preset.width / preset.height;
              const glyphW = ratio >= 1 ? 13 : 13 * ratio;
              const glyphH = ratio >= 1 ? 13 / ratio : 13;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setExportFrame({ width: preset.width, height: preset.height })}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]'
                      : 'border-[var(--divider)] bg-[var(--hover)] text-[var(--text-2)] hover:bg-[var(--active)]'
                  }`}
                >
                  <span
                    className="flex h-[14px] w-[14px] items-center justify-center"
                    aria-hidden="true"
                  >
                    <span
                      className="rounded-[2px] border border-current"
                      style={{ width: glyphW, height: glyphH }}
                    />
                  </span>
                  {preset.label}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Collapsed pill — fades/scales in when collapsed. */}
      <div
        inert={!collapsed}
        aria-hidden={!collapsed}
        className={`absolute inset-x-0 top-0 flex justify-center ${transition} ${
          collapsed ? 'opacity-100' : 'pointer-events-none translate-y-1 scale-[0.98] opacity-0'
        }`}
      >
        <div className="glass pointer-events-auto flex items-center gap-2.5 rounded-full bg-[var(--glass-strong)] py-1.5 pl-3 pr-1.5 text-[var(--text)]">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-2 rounded-full px-1 text-left transition-colors hover:text-[var(--accent)]"
            title="Expand map setup"
          >
            <Map size={14} className="text-[var(--text-3)]" />
            <span className="max-w-[180px] truncate text-[12px] font-semibold">{basemap.name}</span>
            <ChevronDown size={14} className="-rotate-90 text-[var(--text-3)]" />
          </button>
          <span className="hidden text-[11px] text-[var(--text-3)] sm:inline">Frame the area, then lock</span>
          {lockButton}
        </div>
      </div>
    </div>
  );
}
