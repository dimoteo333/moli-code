import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Root vitest should mirror the documented unit-test scope for moli-code.
    // Integration and package-specific suites remain runnable from their own configs.
    projects: ['packages/cli', 'packages/core', 'scripts'],
  },
});
