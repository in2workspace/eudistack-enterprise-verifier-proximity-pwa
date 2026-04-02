import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import { randomBytes, randomUUID } from 'crypto';
import { webcrypto } from 'crypto';

// Polyfill for structuredClone (Node 16 doesn't have it natively)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
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

setupZoneTestEnv();