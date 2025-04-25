import { defineWorkspace } from 'vitest/config';

const browser = process.env.TEST_BROWSER || 'chrome';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'browser',
      browser: {
        enabled: true,
        provider: 'webdriverio',
        headless: process.env.TEST_HEADLESS !== 'false',
        instances: [
          {
            name: browser,
            browser,
            capabilities: {
              "goog:chromeOptions": {
                args: [
                  "--autoplay-policy=no-user-gesture-required",
                  "--enable-precise-memory-info",
                  "--js-flags=--expose-gc"
                ]
              },
              "moz:firefoxOptions": {
                prefs: {
                  "media.autoplay.default": 0,
                  "media.autoplay.enabled.user-gestures-needed": false,
                  "media.autoplay.block-webaudio": false,
                  "media.autoplay.ask-permission": false,
                  "media.autoplay.block-event.enabled": false,
                  "media.block-autoplay-until-in-foreground": false
                }
              },
              "ms:edgeOptions": {
                args: ["--autoplay-policy=no-user-gesture-required"]
              },
              "safari:autoplay": true
            }
          } as any
        ],
        viewport: {
          width: 1920,
          height: 1080
        }
      }
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'ci'
    }
  }
]);
