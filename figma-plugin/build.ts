/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build the Figma plugin: `dist/code.js` (the sandbox code) and `dist/ui.html`
 * (the UI, its script inlined, because Figma loads `ui.html` as one string and
 * the manifest allows no domain to fetch anything from).
 *
 * Both are bundled by Bun from `src/`, which pulls the CLI's own contract code
 * (`src/domain/models/...`) into the plugin, so the plugin and the CLI read and
 * write one document format from one source. `bun run build:figma-plugin`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = import.meta.dir
const DIST = join(ROOT, 'dist')
const MARKER = '<!-- sovrium:ui-script -->'

/** One entry, bundled for Figma: a single IIFE script with every import inlined. */
export const bundle = async (entry: string): Promise<string> => {
  const result = await Bun.build({
    entrypoints: [join(ROOT, 'src', entry)],
    format: 'iife',
    target: 'browser',
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const [output] = result.outputs
  if (!result.success || output === undefined) {
    throw new AggregateError(result.logs, `Bundling ${entry} failed.`)
  }
  return output.text()
}

const main = async () => {
  const [code, ui] = await Promise.all([bundle('code.ts'), bundle('ui.ts')])
  const template = readFileSync(join(ROOT, 'src', 'ui.html'), 'utf8')
  if (template.split(MARKER).length !== 2) {
    throw new Error(`src/ui.html must hold the marker ${MARKER} exactly once.`)
  }
  // A literal `</script` inside the bundle would close the inline script early.
  const html = template.replace(
    MARKER,
    () => `<script>${ui.replaceAll('</script', '<\\/script')}</script>`
  )
  mkdirSync(DIST, { recursive: true })
  writeFileSync(join(DIST, 'code.js'), code)
  writeFileSync(join(DIST, 'ui.html'), html)
  console.log(
    `figma-plugin: dist/code.js ${(code.length / 1024).toFixed(1)} KB, dist/ui.html ${(html.length / 1024).toFixed(1)} KB`
  )
}

if (import.meta.main) await main()
