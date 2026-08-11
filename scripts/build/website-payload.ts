/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared tree builder for the two flattened copies of `apps/website`:
 *
 *   1. the Scalingo deploy tree  (`scripts/build-website-deploy-tree.sh`)
 *   2. the public GitHub mirror  (`scripts/build/publish-website-repo.ts`)
 *
 * Both flatten the app to a root layout so `sovrium start app.ts` resolves
 * ./config, ./content and ./public exactly as the live preview does. They differ
 * ONLY in the public-asset strip: the deploy tree ships the real site verbatim,
 * while the mirror drops assets that must not be redistributed. Keeping one
 * copy routine means the residue strip can never drift between them.
 *
 * Usage (CLI, consumed by the deploy bash script):
 *   bun run scripts/build/website-payload.ts <src-dir> <dest-dir> [--strip-public-assets]
 */

import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { syncInstallScript } from './sync-install-script'

/** Top-level entries copied from `apps/website/` to the tree root, in order. */
export const WEBSITE_PAYLOAD_ENTRIES = ['app.ts', 'config', 'content', 'public'] as const

/**
 * Paths (relative to the app root) stripped ONLY from the public mirror.
 *
 * - `public/thomas-jeanneau.jpg` — personal likeness, not a project asset.
 * - `public/schema/app.json` — a 4.3 MB generated artifact (~2/3 of public/),
 *   canonically served at https://sovrium.com/schema/app.json. Vendoring it into
 *   a public repo bloats history on every schema change for no reader benefit.
 *
 * The deploy tree keeps both — the live site needs them.
 */
export const MIRROR_ONLY_STRIP = ['public/thomas-jeanneau.jpg', 'public/schema/app.json'] as const

/** Directory holding both first-party brand marks and third-party customer logos. */
const LOGOS_DIR = 'public/logos'

/**
 * First-party marks kept in the mirror. Everything else under `public/logos/` is
 * a customer's trademark: Sovrium may display those on its own site as social
 * proof, but redistributing them in a source-available repo would purport to
 * license marks it does not own.
 *
 * Deliberately an ALLOWLIST, not a denylist of the ten current customer logos —
 * so a customer logo added later is stripped by default rather than silently
 * published because nobody remembered to update this file. `github-mark*` is
 * GitHub's own link icon, distributed by GitHub for exactly this use.
 */
const FIRST_PARTY_LOGO = /^(sovrium-|github-mark)/

export interface WebsitePayloadOptions {
  /** Apply MIRROR_ONLY_STRIP. Defaults to false so the deploy tree is verbatim. */
  readonly stripPublicAssets?: boolean
}

/** Runtime/dev residue never shipped in ANY tree — preview data, OS cruft, env files. */
const isResidue = (basename: string): boolean =>
  basename === '.DS_Store' || basename.startsWith('.sovrium') || basename.startsWith('.env')

/**
 * Pure include/exclude decision for one path, relative to the app root
 * (e.g. `public/logos/escp.png`). Exported as the testable seam — the cpSync
 * filter below is a thin adapter over it.
 */
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

/**
 * Copy the website payload from `srcDir` (an `apps/website`-shaped directory)
 * into `destDir`, flattened to the root.
 */
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
  // `public/install` is generated from install.sh, so a deploy tree built from a
  // clean checkout would otherwise ship without the install one-liner.
  syncInstallScript()
  copyWebsitePayload(srcDir, destDir, {
    stripPublicAssets: process.argv.includes('--strip-public-assets'),
  })
}
