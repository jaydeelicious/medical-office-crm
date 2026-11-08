
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxWorkers: 2,
    reporters: [
      'default',
      ['junit', {
        outputFile: './test-results/vitest-junit.xml',
      }],
    ],
  },
});
