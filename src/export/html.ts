import maplibreJs from 'maplibre-gl/dist/maplibre-gl.js?raw';
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?raw';
// pmtiles' package exports expose only the ESM API; the browser IIFE is still
// shipped in dist and is intentionally embedded verbatim in exported HTML.
import pmtilesJs from '../../node_modules/pmtiles/dist/pmtiles.js?raw';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { CartoProject, GeoJsonLayer } from '@/project/cartoproj';
import { buildBasemapStyle } from '@/basemap/basemapStyle';
import { fillColorExpression, proportionalRadiusExpression } from '@/canvas/syncLayers';
import { exportSvg } from './svg';
import type { ExportResult } from './raster';

export interface HtmlExportOptions {
  panZoom: boolean;
  minZoom: number;
  maxZoom: number;
  tooltipProperties: Record<string, string[]>;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\>');
}

function sourceId(layer: GeoJsonLayer): string {
  return `gc-html:${layer.id}`;
}

function interactiveLayerIds(layer: GeoJsonLayer): string[] {
  return [`${sourceId(layer)}:fill`, `${sourceId(layer)}:line`, `${sourceId(layer)}:circle`];
}

function appendGeoJsonLayers(style: StyleSpecification, layers: GeoJsonLayer[]): string[] {
  const ids: string[] = [];
  for (const layer of layers) {
    if (!layer.visible || layer.renderStrategy === 'heatmap') continue;
    const source = sourceId(layer);
    style.sources[source] = { type: 'geojson', data: layer.data };
    const renderIds = interactiveLayerIds(layer);
    const specs: LayerSpecification[] = [
      {
        id: renderIds[0],
        type: 'fill',
        source,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': fillColorExpression(layer) as string, 'fill-opacity': layer.style.fillOpacity },
      },
      {
        id: renderIds[1],
        type: 'line',
        source,
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']],
        paint: { 'line-color': layer.style.strokeColor, 'line-width': layer.style.strokeWidth },
      },
      {
        id: renderIds[2],
        type: 'circle',
        source,
        filter: ['==', ['geometry-type'], 'Point'],
        layout: { visibility: layer.style.showPoints ? 'visible' : 'none' },
        paint: {
          'circle-color': layer.style.dataStyle?.kind === 'proportional' ? layer.style.dataStyle.color : layer.style.pointColor,
          'circle-radius': proportionalRadiusExpression(layer) as number,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      },
    ];
    style.layers.push(...specs);
    ids.push(...renderIds);
  }
  return ids;
}

async function annotationOverlay(project: CartoProject, anchorMode: 'map' | 'canvas'): Promise<string> {
  const overlayProject: CartoProject = {
    ...project,
    exportFrame: { ...project.exportFrame, background: 'transparent' },
    annotations: project.annotations.filter((annotation) => annotation.anchorMode === anchorMode),
  };
  const result = await exportSvg(overlayProject, { includeBasemap: false });
  return result.blob.text();
}

async function projectedHtml(project: CartoProject): Promise<string> {
  const result = await exportSvg(
    { ...project, exportFrame: { ...project.exportFrame, background: project.exportFrame.background ?? 'white' } },
    { includeBasemap: true },
  );
  const svg = await result.blob.text();
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${project.meta.name}</title><style>html,body{margin:0;width:100%;height:100%;background:#111}body{display:grid;place-items:center}svg{display:block;max-width:100%;max-height:100%;width:auto;height:auto}</style></head><body>${svg}</body></html>`;
}

/** Build one portable HTML file with the exact MapLibre/PMTiles runtimes, data, and overlays inlined. */
export async function exportHtml(project: CartoProject, options: HtmlExportOptions): Promise<ExportResult> {
  if (project.engine === 'projected') {
    const html = await projectedHtml(project);
    return htmlResult(project, html);
  }

  const built = project.basemap.kind === 'static' || project.basemap.kind === 'pmtiles-file'
    ? { version: 8 as const, sources: {}, layers: [{ id: 'background', type: 'background' as const, paint: { 'background-color': 'rgba(0,0,0,0)' } }] }
    : buildBasemapStyle(project.basemap);
  const style: StyleSpecification | string = typeof built === 'string'
    ? built
    : structuredClone(built);
  const dataOverlayStyle: StyleSpecification = { version: 8, sources: {}, layers: [] };
  const layerIds = appendGeoJsonLayers(typeof style === 'string' ? dataOverlayStyle : style, project.layers);
  const [mapOverlay, canvasOverlay] = await Promise.all([
    annotationOverlay(project, 'map'),
    annotationOverlay(project, 'canvas'),
  ]);
  const staticImage = project.basemap.kind === 'static' && project.basemap.mediaType === 'image'
    ? project.basemap.dataUrl
    : null;
  const runtimeData = {
    style,
    layerIds,
    viewport: project.viewport,
    frame: project.exportFrame,
    panZoom: options.panZoom,
    minZoom: options.minZoom,
    maxZoom: options.maxZoom,
    tooltipProperties: options.tooltipProperties,
    layerByRenderId: Object.fromEntries(project.layers.flatMap((layer) => interactiveLayerIds(layer).map((id) => [id, layer.id]))),
    extraSources: typeof style === 'string' ? dataOverlayStyle.sources : {},
    extraLayers: typeof style === 'string' ? dataOverlayStyle.layers : [],
  };
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${project.meta.name.replace(/[<>&]/g, '')}</title><style>${maplibreCss}
html,body,#map{margin:0;width:100%;height:100%;overflow:hidden}body{background:${project.exportFrame.background === 'transparent' ? 'transparent' : project.exportFrame.background ?? 'white'}}
.gc-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden}.gc-overlay svg{width:100%;height:100%;display:block}.gc-tooltip{font:12px/1.4 system-ui,sans-serif}.gc-tooltip b{display:block;margin-bottom:2px}
</style></head><body><div id="map"></div>${staticImage ? `<img src="${staticImage}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none">` : ''}<div id="map-overlay" class="gc-overlay">${mapOverlay}</div><div class="gc-overlay">${canvasOverlay}</div>
<script>${maplibreJs}</script><script>${pmtilesJs}</script><script>
const cfg=${safeJson(runtimeData)};
if(window.pmtiles){const protocol=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',protocol.tile);}
const map=new maplibregl.Map({container:'map',style:cfg.style,center:cfg.viewport.center,zoom:cfg.viewport.zoom,bearing:cfg.viewport.bearing,pitch:cfg.viewport.pitch,minZoom:cfg.minZoom,maxZoom:cfg.maxZoom,attributionControl:true,dragPan:cfg.panZoom,scrollZoom:cfg.panZoom,boxZoom:cfg.panZoom,doubleClickZoom:cfg.panZoom,keyboard:cfg.panZoom,touchZoomRotate:cfg.panZoom,dragRotate:cfg.panZoom});
map.on('load',()=>{for(const [id,source] of Object.entries(cfg.extraSources||{})){if(!map.getSource(id))map.addSource(id,source);}for(const layer of cfg.extraLayers||[]){if(!map.getLayer(layer.id))map.addLayer(layer);}});
const escapeHtml=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:10});
for(const id of cfg.layerIds){map.on('mousemove',id,(event)=>{const feature=event.features&&event.features[0];if(!feature)return;const layerId=cfg.layerByRenderId[id];const wanted=cfg.tooltipProperties[layerId]||[];const keys=wanted.length?wanted:Object.keys(feature.properties||{}).filter(k=>!k.startsWith('@')).slice(0,6);const rows=keys.filter(k=>feature.properties&&feature.properties[k]!=null).map(k=>'<b>'+escapeHtml(k)+'</b>'+escapeHtml(feature.properties[k])).join('');if(!rows)return;popup.setLngLat(event.lngLat).setHTML('<div class="gc-tooltip">'+rows+'</div>').addTo(map);});map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',id,()=>{map.getCanvas().style.cursor='';popup.remove();});}
const overlay=document.getElementById('map-overlay');const initialCenter=cfg.viewport.center;const initialZoom=cfg.viewport.zoom;const initialBearing=cfg.viewport.bearing;
const syncOverlay=()=>{const p=map.project(initialCenter);const scale=Math.pow(2,map.getZoom()-initialZoom);const rotation=map.getBearing()-initialBearing;overlay.style.transformOrigin='50% 50%';overlay.style.transform='translate('+(p.x-map.getContainer().clientWidth/2)+'px,'+(p.y-map.getContainer().clientHeight/2)+'px) scale('+scale+') rotate('+rotation+'deg)';};map.on('move',syncOverlay);map.on('load',syncOverlay);
</script></body></html>`;
  return htmlResult(project, html);
}

function htmlResult(project: CartoProject, html: string): ExportResult {
  const base = project.meta.name?.trim() || 'Untitled';
  return {
    blob: new Blob([html], { type: 'text/html' }),
    fileName: `${base.replace(/\.cartoproj$/, '')}.html`,
    width: project.exportFrame.width,
    height: project.exportFrame.height,
  };
}

export function estimateHtmlSize(project: CartoProject): number {
  const dataBytes = project.layers.reduce((sum, layer) => sum + JSON.stringify(layer.data).length, 0);
  return maplibreJs.length + maplibreCss.length + pmtilesJs.length + dataBytes + 20_000;
}
