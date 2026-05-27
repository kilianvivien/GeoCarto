import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentStore } from './documentStore';
import { useSessionsStore } from './sessionsStore';
import { useHistoryStore } from './historyStore';
import { createEmptyProject } from '@/project/cartoproj';

describe('sessionsStore', () => {
  beforeEach(() => {
    useDocumentStore.setState({
      project: createEmptyProject('Tab 0'),
      file: null,
      selectedLayerId: null,
      selectedAnnotationId: null,
      selectedFeature: null,
      dirty: false,
    });
    useHistoryStore.getState().reset();
    const fresh = {
      id: 'session-0',
      autosaveKey: 'cartoproj:autosave:session:session-0',
      lastActiveAt: new Date().toISOString(),
      snapshot: null,
    };
    useSessionsStore.setState({ sessions: [fresh], activeSessionId: fresh.id });
  });

  it('parks the active session and hydrates the new one when switching tabs', () => {
    useSessionsStore.getState().newSession(createEmptyProject('Tab 1'), null);
    expect(useDocumentStore.getState().project.meta.name).toBe('Tab 1');

    useSessionsStore.getState().switchTo('session-0');
    expect(useDocumentStore.getState().project.meta.name).toBe('Tab 0');
  });

  it('preserves dirty state per tab', () => {
    useDocumentStore.setState({ dirty: true });
    const newId = useSessionsStore.getState().newSession(createEmptyProject('Tab 1'), null);
    expect(useDocumentStore.getState().dirty).toBe(false);
    useSessionsStore.getState().switchTo('session-0');
    expect(useDocumentStore.getState().dirty).toBe(true);
    useSessionsStore.getState().switchTo(newId);
    expect(useDocumentStore.getState().dirty).toBe(false);
  });

  it('replaces the last tab with a fresh untitled project on close', () => {
    useDocumentStore.setState({ dirty: true });
    useSessionsStore.getState().closeSession('session-0');
    expect(useSessionsStore.getState().sessions).toHaveLength(1);
    expect(useDocumentStore.getState().project.meta.name).toBe('Untitled');
    expect(useDocumentStore.getState().dirty).toBe(false);
  });

  it('closes a non-active tab without touching the active session', () => {
    useSessionsStore.getState().newSession(createEmptyProject('Tab 1'), null);
    const tab1Id = useSessionsStore.getState().activeSessionId;
    useSessionsStore.getState().closeSession('session-0');
    expect(useSessionsStore.getState().sessions.map((s) => s.id)).toEqual([tab1Id]);
    expect(useDocumentStore.getState().project.meta.name).toBe('Tab 1');
  });

  it('reorders tabs', () => {
    useSessionsStore.getState().newSession(createEmptyProject('Tab 1'), null);
    useSessionsStore.getState().newSession(createEmptyProject('Tab 2'), null);
    useSessionsStore.getState().reorder(0, 2);
    const ids = useSessionsStore.getState().sessions.map((s) => s.id);
    expect(ids[2]).toBe('session-0');
  });
});
