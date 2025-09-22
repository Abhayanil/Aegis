import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'integration',
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      'tests/integration/test-runner.ts',
      'tests/integration/vitest.integration.config.ts'
    ],
    testTimeout: 30000, // 30 seconds default timeout
    hookTimeout: 10000, // 10 seconds for setup/teardown
    teardownTimeout: 10000,
    // Increase timeouts for integration tests
    slowTestThreshold: 5000,
    // Run tests sequentially to avoid resource conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Custom reporters for integration tests
    reporters: [
      'default',
      'json',
      ['html', { outputFile: 'tests/integration/reports/index.html' }],
    ],
    outputFile: {
      json: 'tests/integration/reports/results.json',
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'tests/integration/coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**',
        'src/**/*.d.ts',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    // Setup files for integration tests
    setupFiles: ['tests/integration/setup.ts'],
    // Global test configuration
    globalSetup: 'tests/integration/global-setup.ts',
    globalTeardown: 'tests/integration/global-teardown.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@tests': path.resolve(__dirname, '..'),
    },
  },
  // Environment variables for testing
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.LOG_LEVEL': '"error"',
  },
});