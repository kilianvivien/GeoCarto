import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmDiscardDirtyProject, createNewProject, replaceCurrentProject } from './documentFlow';
import { createEmptyProject } from './cartoproj';
import { useDocumentStore } from '@/state/documentStore';

vi.mock('./autosave', () => ({
  clearAutosave: vi.fn(),
}));

describe('documentFlow', () => {
  beforeEach(() => {
    useDocumentStore.setState({
      project: createEmptyProject('Existing'),
      selectedLayerId: null,
      selectedAnnotationId: null,
      selectedFeature: null,
      dirty: false,
      file: { handle: null, name: 'existing.cartoproj' },
    });
    vi.restoreAllMocks();
  });

  it('does not prompt when the current project is clean', () => {
    const confirm = vi.spyOn(window, 'confirm');
    expect(confirmDiscardDirtyProject()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('prompts before discarding dirty work', () => {
    useDocumentStore.setState({ dirty: true });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(confirmDiscardDirtyProject()).toBe(false);
  });

  it('creates a fresh untitled project and clears the file binding', () => {
    useDocumentStore.setState({ dirty: true });
    createNewProject();
    expect(useDocumentStore.getState().project.meta.name).toBe('Untitled');
    expect(useDocumentStore.getState().project.layers).toEqual([]);
    expect(useDocumentStore.getState().file).toBeNull();
    expect(useDocumentStore.getState().dirty).toBe(false);
  });

  it('replaces the current project with the supplied file binding', () => {
    const replacement = createEmptyProject('Replacement');
    replaceCurrentProject(replacement, { handle: null, name: 'replacement.cartoproj' });
    expect(useDocumentStore.getState().project.meta.name).toBe('Replacement');
    expect(useDocumentStore.getState().file?.name).toBe('replacement.cartoproj');
  });
});
