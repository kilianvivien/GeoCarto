import { MapCanvas } from '@/canvas/MapCanvas';
import { ToolRail } from './ToolRail';
import { Inspector } from './Inspector';
import { RecoveryPrompt } from './RecoveryPrompt';

/** Workspace row: tool rail · canvas · inspector (design.md §4 layout). */
export function Workspace({ chromeSettling }: { chromeSettling: boolean }) {
  return (
    <div className="grid min-h-0 grid-cols-[auto_1fr_auto]">
      <ToolRail />
      <div className="relative grid min-h-0 min-w-0 grid-rows-[1fr]">
        <MapCanvas chromeSettling={chromeSettling} />
        {/* Mounted in the canvas column so its `inset-x-0` centers on the
            canvas — at the window level the rail and inspector pull center off. */}
        <RecoveryPrompt />
      </div>
      <Inspector />
    </div>
  );
}
