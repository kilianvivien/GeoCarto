import { useState } from 'react';
import { SlidersHorizontal, Layers, Palette, type LucideIcon } from 'lucide-react';

type PaneKey = 'properties' | 'layers' | 'style';

const TABS: { key: PaneKey; label: string; icon: LucideIcon }[] = [
  { key: 'properties', label: 'Properties', icon: SlidersHorizontal },
  { key: 'layers', label: 'Layers', icon: Layers },
  { key: 'style', label: 'Style', icon: Palette },
];

const PANE_STUBS: Record<PaneKey, string> = {
  properties: 'Select a tool or object to see its properties.',
  layers: 'Imported layers and annotations will appear here.',
  style: 'Basemap, map layers, and page settings will appear here.',
};

/**
 * Right-hand inspector (design.md §4.4). Tab chrome is wired; pane bodies are
 * placeholders until Milestones 3–4 add real selection/layer/style controls.
 */
export function Inspector() {
  const [pane, setPane] = useState<PaneKey>('properties');

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
      <div role="tabpanel" className="flex-1 overflow-y-auto p-4 text-[12px] text-[var(--text-3)]">
        {PANE_STUBS[pane]}
      </div>
    </aside>
  );
}
