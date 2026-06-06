import { useEffect, useState } from 'react';
import { SlidersHorizontal, Layers, Palette, type LucideIcon } from 'lucide-react';
import { LayerPanel } from '@/layers/LayerPanel';
import { AttributeInspector } from '@/layers/AttributeInspector';
import { AnnotationInspector } from '@/tools/AnnotationInspector';
import { StylePanel } from './StylePanel';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore } from '@/state/toolStore';
import { useLocale } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';

type PaneKey = 'properties' | 'layers' | 'style';

const TABS: { key: PaneKey; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { key: 'properties', labelKey: 'inspector.properties', icon: SlidersHorizontal },
  { key: 'layers', labelKey: 'inspector.layers', icon: Layers },
  { key: 'style', labelKey: 'inspector.style', icon: Palette },
];

/** Right-hand inspector (design.md §4.4). */
export function Inspector() {
  const t = useLocale((s) => s.t);
  const [pane, setPane] = useState<PaneKey>('layers');
  const activeTool = useToolStore((s) => s.activeTool);
  const selectedAnnotationId = useDocumentStore((s) => s.selectedAnnotationId);
  const selectedLayerId = useDocumentStore((s) => s.selectedLayerId);
  const selectedFeature = useDocumentStore((s) => s.selectedFeature);

  useEffect(() => {
    if (activeTool !== 'move' || selectedAnnotationId) setPane('properties');
  }, [activeTool, selectedAnnotationId]);

  useEffect(() => {
    if (selectedFeature || selectedLayerId || selectedAnnotationId) setPane('properties');
  }, [selectedAnnotationId, selectedFeature, selectedLayerId]);

  return (
    <aside className="glass m-1.5 flex w-[300px] flex-col overflow-hidden">
      <div role="tablist" className="flex gap-1 border-b border-[var(--divider)] p-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = pane === tab.key;
          const label = t(tab.labelKey);
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
              {label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="flex-1 overflow-y-auto p-4">
        {pane === 'properties' &&
          ((selectedFeature || selectedLayerId) && !selectedAnnotationId ? (
            <AttributeInspector />
          ) : (
            <AnnotationInspector />
          ))}
        {pane === 'layers' && <LayerPanel />}
        {pane === 'style' && <StylePanel />}
      </div>
    </aside>
  );
}
