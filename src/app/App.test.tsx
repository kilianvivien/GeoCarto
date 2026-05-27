import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { useDocumentStore } from '@/state/documentStore';
import { createEmptyProject, DEFAULT_ANNOTATION_STYLE, type Annotation } from '@/project/cartoproj';
import { useToolStore } from '@/state/toolStore';
import { DEFAULT_VIEWPORT } from '@/state/viewportStore';

// MapLibre needs a real WebGL context — stub the map for the jsdom render.
vi.mock('@/canvas/MapView', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

vi.mock('@/canvas/AnnotationStage', () => ({
  AnnotationStage: () => <div data-testid="annotation-stage" />,
}));

function makeAnnotation(): Annotation {
  return {
    id: 'annotation-1',
    kind: 'text',
    name: 'Title label',
    visible: true,
    locked: false,
    anchorMode: 'canvas',
    position: { x: 20, y: 30 },
    geoAnchor: null,
    rotation: 0,
    opacity: 1,
    style: { ...DEFAULT_ANNOTATION_STYLE },
    text: 'Hello map',
    width: 180,
  };
}

describe('App', () => {
  beforeEach(() => {
    useDocumentStore.setState({
      project: createEmptyProject(),
      selectedLayerId: null,
      selectedAnnotationId: null,
      selectedFeature: null,
    });
    useToolStore.setState({
      activeTool: 'move',
      defaultAnchorMode: 'canvas',
      defaultStyle: { ...DEFAULT_ANNOTATION_STYLE },
    });
  });

  it('renders the app shell chrome', () => {
    render(<App />);
    expect(screen.getByRole('application', { name: /geocarto/i })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: /tools/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /properties/i })).toBeInTheDocument();
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
  });

  it('updates the shared active tool from the rail', () => {
    render(<App />);
    expect(screen.getByText(/set up map/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /text/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /lock map area/i }));
    fireEvent.click(screen.getByRole('button', { name: /text/i }));
    expect(useToolStore.getState().activeTool).toBe('text');
    expect(screen.getByText(/text defaults/i)).toBeInTheDocument();
  });

  it('keeps Phase 2 tools and titlebar actions disabled', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /lock map area/i }));

    fireEvent.click(screen.getByRole('button', { name: /ruler/i }));
    expect(useToolStore.getState().activeTool).toBe('move');
    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /snap/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /share/i })).toBeDisabled();
  });

  it('prompts before creating a new project over dirty work', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    useDocumentStore.getState().addAnnotation(makeAnnotation());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /new project/i }));

    expect(confirm).toHaveBeenCalled();
    expect(useDocumentStore.getState().project.annotations).toHaveLength(1);
  });

  it('shows selected annotation properties and deletes editable annotations', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    useDocumentStore.getState().addAnnotation(makeAnnotation());
    render(<App />);

    expect(screen.getByDisplayValue('Hello map')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useDocumentStore.getState().project.annotations).toEqual([]);
  });
});
