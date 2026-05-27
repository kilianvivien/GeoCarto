import { useDocumentStore } from '@/state/documentStore';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
      {children}
    </div>
  );
}

/** Properties pane — feature attributes when a feature is picked, else layer info. */
export function AttributeInspector() {
  const feature = useDocumentStore((s) => s.selectedFeature);
  const layers = useDocumentStore((s) => s.project.layers);
  const selectedLayerId = useDocumentStore((s) => s.selectedLayerId);
  const updateLayerStyle = useDocumentStore((s) => s.updateLayerStyle);

  if (feature) {
    const layer = layers.find((l) => l.id === feature.layerId);
    const entries = Object.entries(feature.properties);
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Eyebrow>Feature</Eyebrow>
          <div className="mt-1 text-[13px] font-semibold text-[var(--text)]">
            {layer?.name ?? 'Unknown layer'}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Eyebrow>Attributes</Eyebrow>
          {entries.length === 0 ? (
            <div className="text-[12px] text-[var(--text-3)]">This feature has no properties.</div>
          ) : (
            <div className="flex flex-col gap-px rounded-[8px] bg-[var(--glass-thin)] p-1">
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
        </div>
      </div>
    );
  }

  const layer = layers.find((l) => l.id === selectedLayerId);
  if (layer) {
    const disabled = layer.locked;
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Eyebrow>Layer</Eyebrow>
          <div className="mt-1 text-[13px] font-semibold text-[var(--text)]">{layer.name}</div>
        </div>
        <div className="flex flex-col gap-px rounded-[8px] bg-[var(--glass-thin)] p-1">
          {[
            ['Geometry', layer.geometry],
            ['Features', String(layer.featureCount)],
            ['Visible', layer.visible ? 'yes' : 'no'],
            ['Locked', layer.locked ? 'yes' : 'no'],
          ].map(([key, value]) => (
            <div key={key} className="grid grid-cols-[88px_1fr] gap-2 px-1.5 py-1">
              <span className="text-[11.5px] text-[var(--text-3)]">{key}</span>
              <span className="mono text-[11.5px] text-[var(--text)]">{value}</span>
            </div>
          ))}
        </div>
        <div className={`flex flex-col gap-2 ${disabled ? 'opacity-65' : ''}`}>
          <Eyebrow>Layer Style</Eyebrow>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            Fill
            <input
              aria-label="Layer fill color"
              type="color"
              value={layer.style.fillColor}
              disabled={disabled}
              onChange={(event) => updateLayerStyle(layer.id, { fillColor: event.target.value })}
              className="h-7 w-full rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)]"
            />
          </label>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            Fill opacity
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
            Stroke
            <input
              aria-label="Layer stroke color"
              type="color"
              value={layer.style.strokeColor}
              disabled={disabled}
              onChange={(event) => updateLayerStyle(layer.id, { strokeColor: event.target.value })}
              className="h-7 w-full rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)]"
            />
          </label>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            Stroke width
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
            Point
            <input
              aria-label="Layer point color"
              type="color"
              value={layer.style.pointColor}
              disabled={disabled}
              onChange={(event) => updateLayerStyle(layer.id, { pointColor: event.target.value })}
              className="h-7 w-full rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)]"
            />
          </label>
          <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-[11.5px] text-[var(--text-3)]">
            Point size
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
          Click a feature on the map to inspect its attributes.
        </div>
      </div>
    );
  }

  return (
    <div className="text-[12px] text-[var(--text-3)]">
      Select a layer or click a feature to see its properties.
    </div>
  );
}
