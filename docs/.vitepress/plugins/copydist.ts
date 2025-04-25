import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs'
import { resolve, join } from 'path'

/**
 * A simple plugin to copy the dist folder to the public folder.
 * Because vitepress doesn't support multiple public folders (with vite-multiple-assets plugin).
 */
export default function copyDistPlugin(base: string) {
  return {
    name: 'copy-dist',
    configureServer() {
      const distPath = resolve(base, 'dist')
      const publicPath = resolve(base, 'docs', 'public', 'dist')

      if (!existsSync(publicPath)) {
        mkdirSync(publicPath, { recursive: true })
      }

      readdirSync(distPath).forEach(file => {
        copyFileSync(
          join(distPath, file),
          join(publicPath, file)
        )
      })
    }
  }
}
