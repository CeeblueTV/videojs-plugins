import { defineConfig, Plugin } from 'vitepress';
import copyDistPlugin from './plugins/copydist';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import container from 'markdown-it-container';
import monaco from 'vite-plugin-monaco-editor';

function renderExample(tokens: any[], idx: number) {
  const token = tokens[idx]
  if (token.nesting === 1) {
    return `<ceeblue-plugin-example>`;
  }

  return '</ceeblue-plugin-example>';
}


export default defineConfig({
  title: 'Video.js Plugin',
  description: 'Videojs set of plugins for playing streams from the Ceeblue cloud',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#646cff' }]
  ],
  themeConfig: {
    logo: {
      src: '/logo.svg',
      alt: 'Ceeblue Logo'
    },
    nav: [
      { text: 'Getting Started', link: '/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Demo', link: 'https://ceeblue-demo-mirror.pages.dev/' },
      { text: 'API', link: 'https://docs.ceeblue.net/reference/welcome-to-the-ceeblue-streaming-cloud-api' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/' }
        ]
      },
      {
        text: 'Examples',
        items: [
          { text: 'Simple player', link: '/examples/simple' },
        ]
      },
      {
        text: 'API',
        items: [
          { text: 'API Reference', link: 'https://docs.ceeblue.net/reference/welcome-to-the-ceeblue-streaming-cloud-api' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ceebluetv/videojs-plugins' }
    ]
  },
  vite: {
    plugins: [
      copyDistPlugin(resolve(fileURLToPath(import.meta.url), '..', '..', '..')),
      // @ts-expect-error - monaco has bad exports
      monaco.default({
        languageWorkers: ['typescript', 'css', 'html', 'json'],
        customDistPath() {
          return resolve(fileURLToPath(import.meta.url), '..', '..', 'public');
        }
      }),
    ],
    ssr: {
      noExternal: ['monaco-editor']
    }
  },
  markdown: {
    config: (md) => {
      md.use(container, 'example', { render: renderExample })
    }
  }
})
