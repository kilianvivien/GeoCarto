import { afterEach, describe, expect, it, vi } from 'vitest';
import { photonProvider } from './photon';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('photonProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps Photon features to normalized GeocodeResult entries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              osm_id: 71525,
              osm_type: 'R',
              name: 'Paris',
              state: 'Île-de-France',
              country: 'France',
              osm_key: 'place',
              osm_value: 'city',
              extent: [2.224, 48.902, 2.469, 48.815],
            },
            geometry: { type: 'Point', coordinates: [2.3488, 48.8534] },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const results = await photonProvider.search('Paris', { lang: 'en', limit: 8, signal: new AbortController().signal });

    expect(results).toEqual([
      {
        id: 'R/71525',
        label: 'Paris',
        kind: 'city',
        context: 'Île-de-France, France',
        center: [2.3488, 48.8534],
        bbox: [2.224, 48.815, 2.469, 48.902],
      },
    ]);
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get('q')).toBe('Paris');
    expect(requestedUrl.searchParams.get('limit')).toBe('8');
  });

  it('returns an empty array for a blank query without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const results = await photonProvider.search('   ', { lang: 'en', limit: 8, signal: new AbortController().signal });
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
