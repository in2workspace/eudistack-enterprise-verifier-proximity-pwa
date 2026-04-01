import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import { randomUUID } from 'crypto';

// Polyfill for crypto.randomUUID in Jest/Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: randomUUID,
    getRandomValues: (arr: any) => require('crypto').randomBytes(arr.length)
  }
});

setupZoneTestEnv();