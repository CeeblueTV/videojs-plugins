import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.d.ts'
      ]
    },
    globals: true,
    environment: 'jsdom',
    browser: {
      enabled: true,
      provider: 'webdriverio',
      headless: process.env.TEST_HEADLESS !== 'false',
      name: process.env.TEST_BROWSER || 'chrome',
      providerOptions: {
        capabilities: {
          browserName: process.env.TEST_BROWSER || 'chrome',
          'goog:chromeOptions': {
            args: [
              '--autoplay-policy=no-user-gesture-required',
              '--disable-features=AutoplayIgnoreWebAudio'
            ]
          },
          'moz:firefoxOptions': {
            prefs: {
              'media.autoplay.default': 0,
              'media.autoplay.enabled.user-gestures-needed': false,
              'media.autoplay.allow-extension-background-pages': true,
              'media.autoplay.allow-muted': true
            }
          },
          'safari:autoplay': true
        }
      }
    }
  }
});
