import { useEffect, useState } from 'react';
import { SlidersHorizontal, Layers, Palette, type LucideIcon } from 'lucide-react';
import { LayerPanel } from '@/layers/LayerPanel';
import { AttributeInspector } from '@/layers/AttributeInspector';
import { AnnotationInspector } from '@/tools/AnnotationInspector';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore } from '@/state/toolStore';

type PaneKey = 'properties' | 'layers' | 'style';

const TABS: { key: PaneKey; label: string; icon: LucideIcon }[] = [
  { key: 'properties', label: 'Properties', icon: SlidersHorizontal },
  { key: 'layers', label: 'Layers', icon: Layers },
  { key: 'style', label: 'Style', icon: Palette },
];

/**
 * Right-hand inspector (design.md §4.4). Properties and Layers panes are live;
 * the Style pane is a placeholder until later milestones.
 */
export function Inspector() {
  const [pane, setPane] = useState<PaneKey>('layers');
  const activeTool = useToolStore((s) => s.activeTool);
  const selectedAnnotationId = useDocumentStore((s) => s.selectedAnnotationId);
  const selectedFeature = useDocumentStore((s) => s.selectedFeature);

  useEffect(() => {
    if (activeTool !== 'move' || selectedAnnotationId) setPane('properties');
  }, [activeTool, selectedAnnotationId]);

  return (
    <aside className="glass m-1.5 flex w-[300px] flex-col overflow-hidden">
      <div role="tablist" className="flex gap-1 border-b border-[var(--divider)] p-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = pane === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setPane(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-[12px] transition-colors ${
                isActive
                  ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)] outline outline-[0.5px] outline-[var(--accent-ring)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="flex-1 overflow-y-auto p-4">
        {pane === 'properties' && (selectedFeature && !selectedAnnotationId ? <AttributeInspector /> : <AnnotationInspector />)}
        {pane === 'layers' && <LayerPanel />}
        {pane === 'style' && (
          <div className="text-[12px] text-[var(--text-3)]">
            Basemap, map layers, and page settings will appear here.
          </div>
        )}
      </div>
    </aside>
  );
}
