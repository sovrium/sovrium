/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')

export const KEEP_SCRIPTS = [
  'prepare',
  'build',
  'build:binary',
  'build:css-assets',
  'build:types',
  'start',
  'typecheck',
] as const

export const FORBIDDEN_SCRIPT_PATTERN =
  /check-quality|check-progress|playwright|eslint|tdd-automation|design-system|apps\/|analyze-commits|release\.ts|knip|kill-zombie|add-license-headers|sqlite-coverage|postprocess-drizzle|generate-sqlite/

type Manifest = Record<string, unknown> & {
  scripts?: Record<string, string>
}

export function buildMirrorManifest(root: Manifest): Manifest {
  const rootScripts = root.scripts ?? {}

  const curatedScripts: Record<string, string> = {}
  for (const key of KEEP_SCRIPTS) {
    const value = rootScripts[key]
    if (value === undefined) continue
    if (FORBIDDEN_SCRIPT_PATTERN.test(value)) {
      throw new Error(
        `Kept mirror script "${key}" references an excluded dev target: ${value}`
      )
    }
    curatedScripts[key] = value
  }

  return { ...root, scripts: curatedScripts }
}


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
