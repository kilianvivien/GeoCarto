import '@testing-library/jest-dom/vitest';

// jsdom lacks URL.createObjectURL — maplibre-gl touches it at module init.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:geocarto-test';
  URL.revokeObjectURL = () => {};
}
