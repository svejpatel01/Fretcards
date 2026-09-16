import { defineConfig, devices } from '@playwright/test'
import { SCALE_MISTAKE_FIXTURE_PATH, TUNER_FIXTURE_PATH } from './tests/e2e/fixturePaths'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/scale-mistake-fake-mic.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${TUNER_FIXTURE_PATH}`,
          ],
        },
      },
    },
    {
      // A separate project because Chromium's fake-audio-capture file is a
      // launch-time flag, fixed for the whole browser process.
      name: 'chromium-scale-mistake',
      testMatch: '**/scale-mistake-fake-mic.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${SCALE_MISTAKE_FIXTURE_PATH}`,
          ],
        },
      },
    },
  ],
})
