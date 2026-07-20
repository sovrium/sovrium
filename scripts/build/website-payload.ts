/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'

export const WEBSITE_PAYLOAD_ENTRIES = ['app.ts', 'config', 'content', 'public'] as const

export const MIRROR_ONLY_STRIP = ['public/thomas-jeanneau.jpg', 'public/schema/app.json'] as const

const LOGOS_DIR = 'public/logos'

const FIRST_PARTY_LOGO = /^(sovrium-|github-mark)/

export interface WebsitePayloadOptions {
  readonly stripPublicAssets?: boolean
}

const isResidue = (basename: string): boolean =>
  basename === '.DS_Store' || basename.startsWith('.sovrium') || basename.startsWith('.env')

export function shouldIncludePath(relPath: string, opts: WebsitePayloadOptions = {}): boolean {
  const segments = relPath.split('/')
  if (segments.some(isResidue)) return false
  if (opts.stripPublicAssets !== true) return true
  if (MIRROR_ONLY_STRIP.some((p) => relPath === p || relPath.startsWith(`${p}/`))) return false
  if (relPath.startsWith(`${LOGOS_DIR}/`)) {
    return FIRST_PARTY_LOGO.test(relPath.slice(LOGOS_DIR.length + 1))
  }
  return true
}

export function copyWebsitePayload(
  srcDir: string,
  destDir: string,
  opts: WebsitePayloadOptions = {}
): void {
  if (!existsSync(join(srcDir, 'app.ts'))) {
    throw new Error(`website payload source is missing app.ts: ${srcDir}`)
  }
  mkdirSync(destDir, { recursive: true })
  for (const entry of WEBSITE_PAYLOAD_ENTRIES) {
    const from = join(srcDir, entry)
    if (!existsSync(from)) throw new Error(`website payload entry missing: ${entry}`)
    cpSync(from, join(destDir, entry), {
      recursive: true,
      filter: (src) => shouldIncludePath(relative(srcDir, src), opts),
    })
  }
}

if (import.meta.main) {
  const [srcDir, destDir] = process.argv.slice(2)
  if (srcDir === undefined || destDir === undefined) {
    console.error('usage: website-payload.ts <src-dir> <dest-dir> [--strip-public-assets]')
    process.exit(1)
  }
  copyWebsitePayload(srcDir, destDir, {
    stripPublicAssets: process.argv.includes('--strip-public-assets'),
  })
}
