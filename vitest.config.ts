import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/instrumentation.ts',
        'src/services/**',
        'src/models/**',
        'src/adapters/email/resend.adapter.ts',
        'src/adapters/storage/gcs.adapter.ts',
        'src/adapters/messaging/fcm.adapter.ts',
      ],
      thresholds: {
        lines: 60,
        branches: 40,
        functions: 50,
        statements: 60,
      },
    },
  },
});
