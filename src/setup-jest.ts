import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import { randomBytes, randomUUID } from 'crypto';
import { webcrypto } from 'crypto';

// Use Node.js native structuredClone (available since Node 17)
// Node 22 (used in CI) has full support
if (typeof global.structuredClone === 'undefined') {
  // Node 17+ has structuredClone in global scope
  if (typeof structuredClone !== 'undefined') {
    global.structuredClone = structuredClone;
  } else {
    // Fallback for Node <17 - throw clear error instead of incorrect behavior
    global.structuredClone = () => {
      throw new Error('structuredClone is not available. Please upgrade to Node.js 17+');
    };
  }
}

// Polyfill for Web Crypto API in Jest/Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: randomUUID,
    getRandomValues: (arr: Uint8Array) => {
      const bytes = randomBytes(arr.length);
      arr.set(bytes);
      return arr;
    },
    // Use Node.js webcrypto for subtle operations
    subtle: webcrypto.subtle
  }
});

// Polyfill for window.matchMedia (not implemented in jsdom).
// Only define when missing and mark configurable:true so individual tests can
// override it with jest.spyOn / Object.defineProperty without throwing.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

setupZoneTestEnv();