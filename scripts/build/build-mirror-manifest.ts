/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build Mirror Manifest Script - Generates the curated public package.json
 *
 * The public GitHub mirror (github.com/sovrium/sovrium) is a filtered publication
 * of the [internal ref] dev repo: scripts/filtered-mirror.sh allowlists only product
 * source + build scripts and excludes all dev tooling ([internal ref], playwright,
 * [internal ref], check-quality.ts, …). The root package.json, however, was historically
 * copied verbatim — dragging 40+ dev scripts whose targets the mirror excludes.
 * That breaks `bun run <x>` for anyone cloning the mirror AND leaks the internal
 * dev process through script names.
 *
 * This generator produces a curated manifest that keeps the dependency graph
 * byte-identical (GitHub release.yml installs with `--frozen-lockfile`, so the
 * mirrored bun.lock MUST stay in sync) and replaces `scripts` with only the
 * public/build-relevant subset whose targets are actually mirrored.
 *
 * Usage:
 *   bun run scripts/build/build-mirror-manifest.ts <output-path>
 *   # e.g. bun run scripts/build/build-mirror-manifest.ts "${MIRROR_DIR}/package.json"
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')

/**
 * Script keys kept in the mirrored manifest. Every target here lives in the
 * mirror allowlist (src/, scripts/build/, tsconfig.json) — verified against
 * .github/workflows/release.yml's actual `bun run` calls (build:types,
 * build:binary) plus the public-facing convenience scripts. The generator only
 * decides WHICH keys survive; each value is copied verbatim from the root
 * scripts so they never drift.
 */
export const KEEP_SCRIPTS = [
  'prepare',
  'build',
  'build:binary',
  'build:css-assets',
  'build:types',
  'start',
  'typecheck',
] as const

/**
 * Any surviving script value matching this pattern means a dev-only target
 * (one the mirror excludes) leaked into the kept set. Fail-closed: the generator
 * throws, and filtered-mirror.sh re-greps the emitted file as a second guard.
 */
export const FORBIDDEN_SCRIPT_PATTERN =
  /check-quality|check-progress|playwright|eslint|tdd-automation|design-system|apps\/|analyze-commits|release\.ts|knip|kill-zombie|add-license-headers|sqlite-coverage|postprocess-drizzle|generate-sqlite/

type Manifest = Record<string, unknown> & {
  scripts?: Record<string, string>
}

/**
 * Pure transform: given the root manifest, return the curated public manifest.
 * Everything except `scripts` is preserved verbatim (lockfile-safe); `scripts`
 * is reduced to the KEEP_SCRIPTS allowlist.
 */
export function buildMirrorManifest(root: Manifest): Manifest {
  const rootScripts = root.scripts ?? {}

  const curatedScripts: Record<string, string> = {}
  for (const key of KEEP_SCRIPTS) {
    const value = rootScripts[key]
    if (value === undefined) continue // tolerate removed scripts; don't invent them
    if (FORBIDDEN_SCRIPT_PATTERN.test(value)) {
      throw new Error(
        `Kept mirror script "${key}" references an excluded dev target: ${value}`
      )
    }
    curatedScripts[key] = value
  }

  return { ...root, scripts: curatedScripts }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const outputPath = process.argv[2]
  if (!outputPath) {
    console.error('Usage: bun run scripts/build/build-mirror-manifest.ts <output-path>')
    process.exit(1)
  }

  const rootManifest = (await Bun.file(join(PROJECT_ROOT, 'package.json')).json()) as Manifest
  const curated = buildMirrorManifest(rootManifest)

  writeFileSync(outputPath, `${JSON.stringify(curated, null, 2)}\n`)

  const keptKeys = Object.keys(curated.scripts ?? {})
  console.log(
    `▸ Wrote curated mirror manifest to ${outputPath} (${keptKeys.length} scripts: ${keptKeys.join(', ')})`
  )
}
