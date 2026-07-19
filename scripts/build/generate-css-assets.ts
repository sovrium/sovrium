/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Scanner } from '@tailwindcss/oxide'
import { generateArbitraryVarSafelist } from '../../src/infrastructure/css/arbitrary-var-safelist'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')

const SCAN_SOURCES = ['src', 'templates'] as const

const TEST_FILE_GLOBS = ['**/*.test.ts', '**/*.test.tsx'] as const

const GENERATED_OUTPUT_REL = 'infrastructure/css/generated-css-assets.ts'

const COPYRIGHT_HEADER = `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */`

function scanCandidates(): readonly string[] {
  const scanner = new Scanner({
    sources: [
      ...SCAN_SOURCES.map((dir) => ({
        base: join(PROJECT_ROOT, dir),
        pattern: '**/*.{ts,tsx}',
        negated: false,
      })),
      {
        base: join(PROJECT_ROOT, 'src'),
        pattern: GENERATED_OUTPUT_REL,
        negated: true,
      },
      ...TEST_FILE_GLOBS.map((pattern) => ({
        base: join(PROJECT_ROOT, 'src'),
        pattern,
        negated: true,
      })),
    ],
  })
  return [...new Set(scanner.scan())].toSorted()
}

function readStylesheet(relPath: string): string {
  return readFileSync(join(PROJECT_ROOT, 'node_modules', relPath), 'utf-8')
}

function formatKb(...strings: readonly string[]): string {
  const bytes = strings.reduce((sum, s) => sum + s.length, 0)
  return `${(bytes / 1000).toFixed(1)} KB`
}

const arbitraryVarSafelist = generateArbitraryVarSafelist()
if (arbitraryVarSafelist.length === 0) {
  throw new Error(
    'generateArbitraryVarSafelist() returned empty — the recipe scan broke; the binary CSS would drop every popup surface.'
  )
}
const POPUP_SURFACE_SENTINEL = 'bg-[var(--sv-bg-overlay,'
if (!arbitraryVarSafelist.some((cls) => cls.startsWith(POPUP_SURFACE_SENTINEL))) {
  throw new Error(
    `Arbitrary-var safelist is missing the popup surface class (${POPUP_SURFACE_SENTINEL}…) — overlays would render transparent in the binary.`
  )
}

const candidates = [...new Set([...scanCandidates(), ...arbitraryVarSafelist])].toSorted()
const tailwindIndexCss = readStylesheet('tailwindcss/index.css')
const twAnimateCss = readStylesheet('tw-animate-css/dist/tw-animate.css')

const outPath = join(PROJECT_ROOT, 'src/infrastructure/css/generated-css-assets.ts')

const fileContent = `// @ts-nocheck -- generated file: huge embedded string literals, never type-checked
/* eslint-disable -- generated file: never linted (see eslint/base.config.ts) */
${COPYRIGHT_HEADER}

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with \`bun run build:css-assets\`.
 *
 * Embedded inputs for the native-free CSS compiler used inside the compiled
 * standalone binary, where neither node_modules nor a scannable working
 * directory exists. See scripts/build/generate-css-assets.ts and issue #19.
 */

/**
 * Tailwind utility candidates discovered by the native @tailwindcss/oxide
 * scanner across ${SCAN_SOURCES.join(', ')}. Stored newline-joined to keep this
 * generated file small for tooling; split back into an array at import time.
 */
export const BUILTIN_CSS_CANDIDATES: readonly string[] = ${JSON.stringify(
  candidates.join('\n')
)}.split('\\n')

/** Upstream \`@import 'tailwindcss'\` stylesheet (tailwindcss/index.css). */
export const TAILWIND_INDEX_CSS: string = ${JSON.stringify(tailwindIndexCss)}

/** Upstream \`@import 'tw-animate-css'\` stylesheet (tw-animate-css/dist/tw-animate.css). */
export const TW_ANIMATE_CSS: string = ${JSON.stringify(twAnimateCss)}
`

writeFileSync(outPath, fileContent)

console.log(
  `✓ generated-css-assets.ts — ${candidates.length} candidates, ` +
    `${formatKb(tailwindIndexCss, twAnimateCss)} embedded stylesheets`
)
