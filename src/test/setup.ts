import '@testing-library/jest-dom/vitest';

// jsdom lacks URL.createObjectURL — maplibre-gl touches it at module init.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:geocarto-test';
  URL.revokeObjectURL = () => {};
}

// jsdom's Blob has no async text() — polyfill via FileReader for import tests.
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
