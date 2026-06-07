import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

const flushActiveAutosave = vi.fn(() => Promise.resolve());
const clearAutosave = vi.fn(() => Promise.resolve());

vi.mock('@/project/autosave', () => ({
  flushActiveAutosave: () => flushActiveAutosave(),
  clearAutosave: () => clearAutosave(),
}));

vi.mock('@/state/sessionsStore', () => ({
  activeSessionId: () => 'session-1',
}));

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    sessionStorage.clear();
    flushActiveAutosave.mockClear();
    clearAutosave.mockClear();
    // React logs the caught error; silence it so the test output stays clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>all good</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('catches a render crash, flushes autosave, and enables reload once saved', async () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(flushActiveAutosave).toHaveBeenCalledTimes(1);

    const reload = screen.getByRole('button', { name: /reload editor/i });
    await waitFor(() => expect(reload).not.toBeDisabled());
    expect(screen.getByText(/your work is saved/i)).toBeInTheDocument();
  });

  it('detects a crash loop and offers to discard the project', () => {
    // A recent prior crash within the loop window primes the loop detection.
    sessionStorage.setItem('geocarto-crash', JSON.stringify({ count: 1, at: Date.now() }));

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/keeps crashing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard project/i })).toBeInTheDocument();
  });
});
