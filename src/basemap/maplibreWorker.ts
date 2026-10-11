import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre 6 is ESM-only and ships its tile worker as a separate file. Under a
// bundler it cannot locate that file on its own, so every module that
// constructs a `Map` imports this one for its side effect.
setWorkerUrl(workerUrl);
