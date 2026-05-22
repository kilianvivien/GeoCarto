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
