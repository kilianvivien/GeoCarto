import { MapCanvas } from '@/canvas/MapCanvas';
import { ToolRail } from './ToolRail';
import { Inspector } from './Inspector';

/** Workspace row: tool rail · canvas · inspector (design.md §4 layout). */
export function Workspace() {
  return (
    <div className="grid min-h-0 grid-cols-[auto_1fr_auto]">
      <ToolRail />
      <MapCanvas />
      <Inspector />
    </div>
  );
}
