/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Generate CSS Assets Script
 *
 * Produces `src/infrastructure/css/generated-css-assets.ts`, which embeds the
 * static inputs the native-free CSS compiler needs to run inside the standalone
 * compiled binary (`bun build --compile`).
 *
 * Why this exists (issue #19):
 *   1. BUILTIN_CSS_CANDIDATES — the compiled binary runs from a virtual
 *      filesystem with no working directory to scan, so the native
 *      `@tailwindcss/oxide` scanner cannot discover which utility classes the
 *      app uses. We run that scanner HERE, on the build machine, and embed the
 *      result. Critically this captures classes from client-side islands,
 *      which never appear in server-rendered HTML.
 *   2. TAILWIND_INDEX_CSS / TW_ANIMATE_CSS — the binary has no node_modules, so
 *      the stylesheets that `@import 'tailwindcss'` / `@import 'tw-animate-css'`
 *      resolve to must be inlined.
 *
 * Runs automatically from `scripts/build/build-binary.ts` before `bun build
 * --compile`, or standalone via `bun run build:css-assets`.
 *
 * Usage:
 *   bun run scripts/build/generate-css-assets.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Scanner } from '@tailwindcss/oxide'
import { generateArbitraryVarSafelist } from '../../src/infrastructure/css/arbitrary-var-safelist'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')

/**
 * Source globs whose Tailwind class usage must be reflected in the binary's CSS.
 *
 * The whole of `src` is scanned (not just `src/presentation`) so any class
 * emitted anywhere in the application — components, the client-side islands,
 * page/error renderers — is covered. Islands are the critical case: they
 * hydrate client-side, so their utility classes never appear in server-rendered
 * HTML and cannot be recovered by the binary's runtime config scan.
 *
 * The operator console USED to need its own entry here, and no longer does:
 * `src/admin/config/**` is inside `src`. That is the whole substance of the
 * entry that stood here — the console is compiled INTO the binary
 * ((../../docs/architecture/decisions/033-apps-admin-first-class-embedded-app.md),
 * relocated by(../../docs/architecture/decisions/035-documentation-co-located-with-code.md)
 * D3), so a class it authors renders on every user's instance and must reach
 * the builtin candidate set exactly like any class under `src`. The move made
 * that true by construction instead of by a list entry, which is the better
 * version of the same guarantee.
 *
 * `apps/` is not scanned at all now, and that is right rather than a loss:
 * `apps/website` and `apps/partner` are Sovrium's own deployed surfaces. Nobody
 * else runs them, their CSS is compiled at runtime from their own theme, and
 * folding their classes into the binary would ship an operator CSS for pages
 * that operator will never serve.
 *
 * Scanning the console's SOURCE is not redundant with the generated preset
 * (`src/infrastructure/assets/embedded-admin-preset.generated.ts`), which the
 * scan already picks up incidentally as a `src` file. The preset is the
 * RESOLVED config: a conditional like `verdict === 'do' ? 'text-foreground-subtle'
 * : 'text-error'` serialises only the branch each fixture item actually took, so
 * a class on an untaken branch exists in the source and in no generated artifact.
 * The source scan sees both branches; the preset scan cannot.
 *
 * That hole is why the console's source is scanned at all, and the coverage is
 * PREVENTIVE — measured on the day the `apps/admin` entry landed, it recovered
 * three rules, all three harvested from doc comments rather than live class
 * usage, for 165 bytes of default stylesheet. Do not read it as having fixed a
 * rendering bug; read it as closing the gap between "a product path compiled
 * into the binary" and "a product path the corpus reads directly". See [internal ref]'s
 * note on this.
 *
 * `[internal ref]` and `[internal ref]` are intentionally excluded: they are not application
 * code, and the classes mentioned there are not part of any rendered page.
 * Co-located unit-test files (`*.test.ts`/`*.test.tsx`) live INSIDE `src` but
 * are excluded for the same reason — see `TEST_FILE_GLOBS` below.
 */
const SCAN_SOURCES = ['src', 'templates'] as const

/**
 * Co-located unit-test files live under `src` but are NOT application code:
 * the utility classes they mention (often sentinel/arbitrary tokens used only
 * to assert behaviour) never reach a rendered page, so they must not widen the
 * binary's builtin candidate set. Excluding them keeps the candidate set to
 * real application classes and keeps `appAddsCandidatesBeyondBuiltin` honest
 * (a test-only token must read as "beyond builtin").
 */
const TEST_FILE_GLOBS = ['**/*.test.ts', '**/*.test.tsx'] as const

/**
 * The generator writes its output to
 * `src/infrastructure/css/generated-css-assets.ts`, which lives INSIDE the `src`
 * scan root. Scanning it re-extracts every class-shaped token from the previous
 * (already huge) output and folds it back into the next run — a self-amplifying
 * loop that grew the file to 404 MB and OOM'd both the runtime Tailwind scan and
 * the lint/typecheck steps. This negated source breaks the loop; restricting the
 * pattern to `*.{ts,tsx}` further keeps non-code artifacts out of the candidate
 * set.
 */
const GENERATED_OUTPUT_REL = 'infrastructure/css/generated-css-assets.ts'

/**
 * The embedded config-types payload
 * (`scripts/build/generate-embedded-config-types.ts`) also lives inside the
 * `src` scan root, and is likewise not application code: it is ~184 KB of
 * TypeScript DECLARATION TEXT held in a string literal — the ambient
 * `declare module 'sovrium'` block `sovrium types` writes into an author's
 * directory. It renders nothing.
 *
 * Scanning it is actively harmful in two ways. It folds every class-shaped
 * token in the declaration (property names, `readonly`, type names, JSDoc
 * words) into the builtin candidate set, which is the same class of pollution
 * `GENERATED_OUTPUT_REL` above exists to prevent. And because the declaration is
 * re-derived from the schema on every binary build, the candidate corpus would
 * churn — and `Generated Assets Drift` would fail — on schema changes that touch
 * no CSS whatsoever.
 */
const EMBEDDED_CONFIG_TYPES_REL = 'infrastructure/assets/embedded-config-types.generated.ts'

/**
 * The default design system's FLAT VIEW
 * (`scripts/build/generate-default-design.ts`) is the third file in the scan
 * root that is derived data rather than application code: every `--sv-*` token
 * and its resolved literal, plus the author-key role map, re-stated in a shape
 * a gate can read.
 *
 * It is negated because it adds NOTHING the corpus does not already have — the
 * same values reach the scan through `default-theme-layer.generated.ts` (which
 * REPLACES a scanned file and therefore stays scanned) — while contributing a
 * second copy of every token name plus its own identifiers. That is the corpus
 * rule applied literally: negate a generated file only when it adds candidates
 * its hand-written predecessor did not, and this one has no predecessor.
 *
 * The other three outputs of that generator stay scanned: each replaces a file
 * the corpus was already built from, so negating them would REMOVE candidates
 * the binary needs.
 */
const DEFAULT_DESIGN_FLAT_REL = 'domain/models/app/design/default-design.generated.ts'

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
      // Break the self-amplifying feedback loop: never scan our own output.
      {
        base: join(PROJECT_ROOT, 'src'),
        pattern: GENERATED_OUTPUT_REL,
        negated: true,
      },
      // Same reasoning, different generator: the embedded `declare module
      // 'sovrium'` payload is declaration TEXT in a string literal, not
      // application code — see EMBEDDED_CONFIG_TYPES_REL.
      {
        base: join(PROJECT_ROOT, 'src'),
        pattern: EMBEDDED_CONFIG_TYPES_REL,
        negated: true,
      },
      // The default design's flat view — derived data, and a duplicate of what
      // the generated theme layer already contributes. See DEFAULT_DESIGN_FLAT_REL.
      {
        base: join(PROJECT_ROOT, 'src'),
        pattern: DEFAULT_DESIGN_FLAT_REL,
        negated: true,
      },
      // Exclude co-located unit-test files from the candidate scan: their
      // sentinel/arbitrary classes are not part of any rendered page.
      ...TEST_FILE_GLOBS.map((pattern) => ({
        base: join(PROJECT_ROOT, 'src'),
        pattern,
        negated: true,
      })),
    ],
  })
  // oxide deliberately over-extracts: it returns every class-shaped token.
  // Tailwind's build() emits CSS only for entries that are valid utilities,
  // so dead candidates cost nothing. Dedupe + sort for a diff-stable file.
  return [...new Set(scanner.scan())].toSorted()
}

function readStylesheet(relPath: string): string {
  return readFileSync(join(PROJECT_ROOT, 'node_modules', relPath), 'utf-8')
}

function formatKb(...strings: readonly string[]): string {
  const bytes = strings.reduce((sum, s) => sum + s.length, 0)
  return `${(bytes / 1000).toFixed(1)} KB`
}

/**
 * Runtime-composed recipe classes (`bg-[${v('sv-X', T.Y)}]` in the
 * `*-default-classes.ts` recipes) are invisible to the oxide source scan — it
 * sees the `${…}` template placeholder, not the resolved literal — so overlay
 * surfaces (menu/select/dialog popups) would ship with no background/border/
 * shadow/ring in the binary (transparent panel + browser-default focus halo).
 * Fold the resolved safelist into the frozen candidate set. Guard loudly so
 * this class can never silently drop out of the binary again.
 */
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
  `generated-css-assets.ts — ${candidates.length} candidates, ` +
    `${formatKb(tailwindIndexCss, twAnimateCss)} embedded stylesheets`
)
