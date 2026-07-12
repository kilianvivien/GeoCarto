import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from 'react';

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

interface TooltipProps {
  /** Primary line — usually the control's name. */
  label: string;
  /** Optional one-line description shown beneath the label (design.md). */
  description?: string;
  /** Optional keyboard shortcut, rendered as a chip. */
  shortcut?: string;
  placement?: TooltipPlacement;
  /** Hover delay before showing, in ms. Focus shows immediately. */
  delay?: number;
  /** When true the tooltip never shows (the trigger still renders). */
  disabled?: boolean;
  /** Exactly one focusable/hoverable trigger element. */
  children: ReactElement<{ 'aria-describedby'?: string }>;
}

const PLACEMENT_CLASS: Record<TooltipPlacement, string> = {
  top: 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
  right: 'left-[calc(100%+8px)] top-1/2 -translate-y-1/2',
  bottom: 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2',
  left: 'right-[calc(100%+8px)] top-1/2 -translate-y-1/2',
};

const HIDDEN_OFFSET: Record<TooltipPlacement, string> = {
  top: 'translate-y-1',
  right: '-translate-x-1',
  bottom: '-translate-y-1',
  left: 'translate-x-1',
};

/**
 * Glass tooltip (M20). A small accessible label/description/shortcut bubble shown
 * on hover or keyboard focus. Listening on the wrapper (not the trigger) means it
 * still works for `disabled` buttons — which suppress their own pointer events —
 * so the rail's "Phase 2 / lock map first" affordances survive the migration off
 * native `title=`. The trigger gets `aria-describedby` via cloneElement.
 */
export function Tooltip({
  label,
  description,
  shortcut,
  placement = 'top',
  delay = 350,
  disabled = false,
  children,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = (immediate = false) => {
    if (disabled) return;
    if (timer.current) clearTimeout(timer.current);
    if (immediate) {
      setOpen(true);
      return;
    }
    timer.current = setTimeout(() => setOpen(true), delay);
  };

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  const trigger = isValidElement(children)
    ? cloneElement(children, { 'aria-describedby': open ? id : undefined })
    : children;

  return (
    <span
      className="relative inline-flex"
      // Hover is a mouse-only concept: on touch/pencil, pointerenter fires on
      // every tap and would flash the tooltip over the control being used.
      // (Unknown/empty pointerType is treated as a mouse.)
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') show();
      }}
      onPointerLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {trigger}
      {!disabled && (
        <span
          role="tooltip"
          id={id}
          aria-hidden={!open}
          className={`pointer-events-none absolute z-[60] flex w-max max-w-[260px] flex-col gap-0.5 whitespace-normal rounded-[8px] border border-[var(--glass-border)] bg-[var(--surface-modal)] px-2.5 py-1.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
            PLACEMENT_CLASS[placement]
          } ${open ? 'opacity-100' : `opacity-0 ${HIDDEN_OFFSET[placement]}`}`}
        >
          <span className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-semibold leading-tight text-[var(--text)]">
              {label}
            </span>
            {shortcut && (
              <kbd className="rounded-[4px] border border-[var(--divider)] bg-[var(--glass-thin)] px-1 py-px font-mono text-[9.5px] font-medium leading-none text-[var(--text-2)]">
                {shortcut}
              </kbd>
            )}
          </span>
          {description && (
            <span className="line-clamp-3 text-[10.5px] leading-snug text-[var(--text-2)]">
              {description}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
