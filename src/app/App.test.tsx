import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { useDocumentStore } from '@/state/documentStore';
import { createEmptyProject, DEFAULT_ANNOTATION_STYLE, type Annotation } from '@/project/cartoproj';
import { useToolStore } from '@/state/toolStore';
import { useSessionsStore } from '@/state/sessionsStore';
import { useHistoryStore } from '@/state/historyStore';
import { DEFAULT_VIEWPORT } from '@/state/viewportStore';
import { useUiStore } from '@/ui/uiStore';
import { useStorageHealth } from '@/project/storageHealth';

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
      selectedAnnotationIds: [],
      selectedFeature: null,
    });
    useToolStore.setState({
      activeTool: 'move',
      defaultAnchorMode: 'canvas',
      defaultStyle: { ...DEFAULT_ANNOTATION_STYLE },
      gridSnapEnabled: false,
      gridSpacing: 20,
      smartGuidesEnabled: true,
    });
    // Reset the per-test sessions registry so the title bar and tab bar start
    // fresh — otherwise previous tests leak tabs into later assertions.
    const fresh = {
      id: 'test-session',
      autosaveKey: 'test',
      lastActiveAt: new Date().toISOString(),
      snapshot: null,
    };
    useSessionsStore.setState({ sessions: [fresh], activeSessionId: fresh.id });
    useHistoryStore.getState().reset();
    useUiStore.setState({
      exportDialogOpen: false,
      settingsDialogOpen: false,
      commandPaletteOpen: false,
      pendingLegendFillSample: null,
      pendingAnnotationFillSample: null,
    });
    useStorageHealth.setState({
      available: true,
      usage: null,
      quota: null,
      draftCount: 0,
      recentCount: 0,
      issues: [],
      checkedAt: null,
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

  it('enables canvas-aid + previously-gated Phase 2 tools, with Snap and Share now interactive', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /lock map area/i }));

    fireEvent.click(screen.getByRole('button', { name: /ruler/i }));
    expect(useToolStore.getState().activeTool).toBe('ruler');
    fireEvent.click(screen.getByRole('button', { name: /marquee/i }));
    expect(useToolStore.getState().activeTool).toBe('marquee');
    // Snap is a live toggle now; Share is enabled in editing mode.
    expect(screen.getByRole('button', { name: /snap/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /share/i })).not.toBeDisabled();
    // Lock + ruler click recorded one undoable step; Undo enables, Redo stays disabled.
    expect(screen.getByRole('button', { name: /undo/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();
  });

  it('opens new project work in a fresh tab rather than discarding the active one', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    useDocumentStore.getState().addAnnotation(makeAnnotation());
    render(<App />);

    // The "New project" button in the title bar always opens a new tab in
    // M8 — the dirty-prompt guard belongs to Close, not New.
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));

    // Active tab is the new empty one; the previous session is parked.
    expect(useDocumentStore.getState().project.annotations).toEqual([]);
  });

  it('shows selected annotation properties and deletes editable annotations', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    useDocumentStore.getState().addAnnotation(makeAnnotation());
    render(<App />);

    expect(screen.getByDisplayValue('Hello map')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useDocumentStore.getState().project.annotations).toEqual([]);
  });

  it('opens the command palette from the keyboard and runs shared app commands', async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search commands/i), {
      target: { value: 'settings' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Run Open settings$/i }));

    expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument();
    await waitFor(() => expect(useStorageHealth.getState().checkedAt).not.toBeNull());
  });

  it('closes settings with Escape and exposes tab panel relationships', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^Open settings$/i }));
    const editorTab = screen.getByRole('tab', { name: /editor/i });
    fireEvent.click(editorTab);

    expect(editorTab).toHaveAttribute('aria-controls', 'settings-panel-editor');
    const settingsDialog = screen.getByRole('dialog', { name: /settings/i });
    expect(within(settingsDialog).getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'settings-tab-editor',
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /settings/i })).not.toBeInTheDocument(),
    );
  });

  it('explains export fidelity in the export dialog', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /export \(⌘e\)/i }));

    expect(screen.getByText('Fidelity')).toBeInTheDocument();
    expect(screen.getByText(/PNG, JPEG, and PDF flatten/)).toBeInTheDocument();
    expect(screen.getByText(/SVG keeps annotations/)).toBeInTheDocument();
    expect(screen.getByText(/GeoJSON export keeps edited layer features/)).toBeInTheDocument();
  });
});
