import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

afterEach(() => {
  cleanup();
  // Each test gets a fresh IndexedDB database
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), writable: true });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// jsdom lacks URL.createObjectURL used by export helpers
let objectUrlCounter = 0;
Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  value: () => `blob:mock-${++objectUrlCounter}`,
});
Object.defineProperty(window.URL, 'revokeObjectURL', {
  writable: true,
  value: () => undefined,
});
window.print = vi.fn();

// jsdom lacks ResizeObserver, required by recharts
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'ResizeObserver', { value: ResizeObserverStub, writable: true });
