import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';

afterEach(() => {
  vi.useRealTimers();
});

describe('Tooltip', () => {
  it('reveals on focus and wires aria-describedby to the trigger', () => {
    render(
      <Tooltip label="Move" description="Select and move" shortcut="V">
        <button type="button">trigger</button>
      </Tooltip>,
    );

    const button = screen.getByRole('button', { name: 'trigger' });
    expect(button).not.toHaveAttribute('aria-describedby');

    fireEvent.focus(button);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Move');
    expect(tip).toHaveTextContent('Select and move');
    expect(tip).toHaveTextContent('V');
    expect(button.getAttribute('aria-describedby')).toBe(tip.id);

    fireEvent.blur(button);
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('still shows for a disabled trigger via the wrapper hover after the delay', () => {
    vi.useFakeTimers();
    render(
      <Tooltip label="Marquee" description="Phase 2" delay={350}>
        <button type="button" disabled>
          trigger
        </button>
      </Tooltip>,
    );

    // Hover enters the wrapper span, not the disabled button (which suppresses
    // its own pointer events); the bubble appears once the delay elapses.
    fireEvent.pointerEnter(screen.getByText('trigger').parentElement!);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Marquee');
  });
});
