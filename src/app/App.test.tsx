import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';

// MapLibre needs a real WebGL context — stub the map for the jsdom render.
vi.mock('@/canvas/MapView', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

describe('App', () => {
  it('renders the app shell chrome', () => {
    render(<App />);
    expect(screen.getByRole('application', { name: /geocarto/i })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: /tools/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /properties/i })).toBeInTheDocument();
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
  });
});
