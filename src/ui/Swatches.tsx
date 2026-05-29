import { useRef, useState } from 'react';
import { ColorPickerPopover } from './ColorPickerPopover';
import { SWATCHES, normalizeHex } from './swatchPalette';

/** Preset palette + a custom color button opening the liquid-glass picker (with eyedropper). */
export function Swatches({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  const normalizedValue = normalizeHex(value);
  const isPreset = SWATCHES.some((c) => normalizeHex(c) === normalizedValue);
  return (
    <div className="grid grid-cols-8 gap-1">
      {SWATCHES.map((color) => {
        const selected = normalizeHex(color) === normalizedValue;
        return (
          <button
            key={color}
            type="button"
            aria-label={`Use ${color}`}
            disabled={disabled}
            onClick={() => onChange(color)}
            className={`h-6 rounded-[7px] border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${
              selected ? 'border-[var(--accent)] ring-2 ring-[var(--accent-ring)]' : 'border-[var(--divider)]'
            }`}
            style={{ background: color }}
          />
        );
      })}
      <CustomColorPicker value={value} active={!isPreset} disabled={disabled} onChange={onChange} />
    </div>
  );
}

/** Rainbow custom-color button that opens the liquid-glass ColorPickerPopover. */
export function CustomColorPicker({
  value,
  active,
  onChange,
  disabled,
}: {
  value: string;
  active: boolean;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  // Conic rainbow used both as the idle glyph and as a halo behind the current
  // custom color so the picker stays visually distinct from the presets.
  const rainbow =
    'conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #5ac8fa, #007aff, #5856d6, #af52de, #ff2d55, #ff3b30)';
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Pick a custom color"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`relative flex h-6 items-center justify-center rounded-[7px] border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${
          active ? 'border-[var(--accent)] ring-2 ring-[var(--accent-ring)]' : 'border-[var(--divider)]'
        }`}
        style={{ background: active ? value : rainbow }}
      >
        {active && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0.5 rounded-[5px] border border-white/40"
          />
        )}
      </button>
      <ColorPickerPopover
        open={open}
        anchorRef={buttonRef}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
