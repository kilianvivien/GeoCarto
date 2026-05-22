import { registerPmtilesProtocol } from '@/basemap/pmtiles';
import { AppShell } from '@/ui/AppShell';

registerPmtilesProtocol();

export function App() {
  return <AppShell />;
}
