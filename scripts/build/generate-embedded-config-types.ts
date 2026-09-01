/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: embed the TypeScript config-authoring payload into the compiled
 * binary — the ambient `declare module 'sovrium'` declaration plus the minimal
 * `tsconfig.json` that makes it resolvable.
 *
 * WHY THIS EXISTS
 * ---------------
 * A Sovrium app must be authorable in TypeScript with ZERO npm: no
 * `package.json`, no `node_modules`, no install step. Three measured facts
 * against the real 0.23.0 binary fix the design:
 *
 *   1. `import type { AppConfig } from 'sovrium'` → binary exits 0. `import
 *      type` is erased at transpile time, so the binary never even attempts to
 *      resolve the specifier.
 *   2. `import { defineConfig } from 'sovrium'` → binary exits 1, `Cannot find
 *      package`, EVEN with the package installed beside `app.ts`. The binary
 *      leaves bare-package specifiers unresolved.
 *   3. An ambient `declare module 'sovrium'` in a `.d.ts` that is part of the
 *      tsc program — plus a bare `tsconfig.json` whose DEFAULT glob picks that
 *      file up — type-checks clean and catches a misspelled property.
 *
 * So the types ship from the binary rather than from npm, and `@sovrium/types`
 * is retired as a published package.
 *
 * TYPES-ONLY IS LOAD-BEARING, NOT TIDINESS
 * ----------------------------------------
 * (1) and (2) together mean a declaration exporting BOTH `AppConfig` and a
 * `defineConfig` helper type-checks clean (tsc exit 0) and then refuses to boot
 * (binary exit 1). That is a type-checks-then-dies trap, and it is strictly
 * worse than a plain failure because it defers the error past the point where
 * the author is looking. Keeping values out makes a value import unreachable BY
 * CONSTRUCTION: it fails type-check for the ordinary reason that no such export
 * exists. `assertTypesOnly()` below fails this build if a value ever creeps in;
 * `[internal ref]` re-asserts it in `bun run
 * quality`; `[internal ref]` and `-005` pin both halves end-to-end.
 *
 * WHY THE OUTPUT IS AN INLINED STRING, NOT A `with { type: 'file' }` IMPORT
 * ------------------------------------------------------------------------
 * The sibling embed manifests (`generate-embedded-ts-lib-types.ts`,
 * `generate-embedded-runtime-assets.ts`) use `with { type: 'file' }`, which
 * resolves to a PATH — the real one in dev, a `/$bunfs/...` one in the binary —
 * and the consumer reads it with `Bun.file()`. That shape is wrong here for two
 * reasons:
 *
 *   - The consumer needs the CONTENT as a `string` (it writes the text into the
 *     author's directory), not a path to read.
 *   - The payload's source, `packages/types/dist/index.d.ts`, is GITIGNORED. A
 *     `type: 'file'` / `type: 'text'` import of it is evaluated at module-import
 *     time, so on a fresh checkout that has not run `bun run build:types` the
 *     import THROWS — taking the whole CLI module graph down with it, not just
 *     `sovrium types`. Inlining the text into this committed module makes the
 *     command work identically from a plain checkout in dev and in the binary,
 *     with no filesystem read at runtime.
 *
 * `bun build --compile` embeds a source-level string constant trivially, so the
 * embed property the sibling manifests buy with `type: 'file'` is free here.
 *
 * STALENESS
 * ---------
 * `build-binary.ts` runs `build-types.ts` then this script BEFORE compiling, so
 * the shipped binary always carries a freshly-derived declaration. The
 * committed copy only backs dev-mode `sovrium types`; the CodeContext half of
 * it is additionally pinned by `[internal ref]`.
 *
 * Regenerate:
 *   bun run scripts/build/build-types.ts
 *   bun run scripts/build/generate-embedded-config-types.ts
 * (both run automatically by `build:binary`).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const DECLARATION_SOURCE = join(PROJECT_ROOT, 'packages', 'types', 'dist', 'index.d.ts')
const OUT_FILE = join(
  PROJECT_ROOT,
  'src',
  'infrastructure',
  'assets',
  'embedded-config-types.generated.ts'
)

/**
 * The minimal `tsconfig.json` `sovrium types` drops beside the declaration.
 *
 * It deliberately sets NEITHER `include` NOR `files`. That omission is the
 * whole point: with neither key, tsc falls back to its default glob (every
 * `.ts`/`.d.ts` under the project directory), which is what pulls
 * `sovrium.d.ts` into the program and makes the bare `sovrium` specifier
 * resolvable at all. A narrow `include` that lists only `app.ts` is a REAL
 * failure mode, not a hypothetical one — the program then contains no ambient
 * declaration, and every config fails with TS2307 (or, worse, silently resolves
 * a stale `node_modules/sovrium` if one happens to be present).
 *
 * `lib` carries DOM alongside ESNext to match the repo's own `tsconfig.json`
 * and the website-repo template: the generated declaration is derived from a
 * program that had DOM loaded, so dropping it risks TS2304 on a structural type
 * that reached the surface through a DOM lib type.
 */
const TSCONFIG_CONTENT = `{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "Preserve",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
`

/**
 * Wrap the flat `.d.ts` body in `declare module 'sovrium' { … }`.
 *
 * The body is inserted VERBATIM — not re-indented. Re-indenting ~6 000 lines
 * would make every regeneration diff unreadable for zero semantic gain: TS does
 * not care about indentation inside a module block.
 *
 * `packages/types/dist/index.d.ts` is already self-contained and import-free
 * (its only `import` string sits inside a JSDoc example), so it wraps without
 * modification.
 */
const wrapAsAmbientModule = (body: string): string =>
  [
    "// AUTO-GENERATED — regenerate with `sovrium types` after upgrading the binary.",
    '// DO NOT EDIT: hand edits are lost on the next `sovrium types` run.',
    '//',
    "// Ambient declaration for the bare `sovrium` specifier. Keep this file in the",
    '// TypeScript program (the generated tsconfig.json sets no `include`, so the',
    "// default glob picks it up) and author your config with a TYPE-ONLY import:",
    '//',
    "//   import type { AppConfig } from 'sovrium'",
    '//',
    "//   export default { name: 'my-app' } satisfies AppConfig",
    '//',
    '// There is deliberately no runtime export here — the binary does not resolve',
    '// bare-package specifiers, so a VALUE import would type-check and then fail',
    '// to boot. A type-only import is erased before the binary ever looks.',
    '',
    "declare module 'sovrium' {",
    body.trimEnd(),
    '}',
    '',
  ].join('\n')

/**
 * Fail the build if the declaration declares any runtime VALUE.
 *
 * Shares its predicate list with `[internal ref]`;
 * duplicated rather than imported so a build never depends on the check module
 * and vice versa. See the header for why this property is load-bearing.
 */
const assertTypesOnly = (declaration: string): void => {
  const violations = [
    /export\s+declare\s+(const|function|var|let|class)\b/,
    /export\s+(const|function|var|let|class)\b/,
    /\bdeclare\s+(const|function|var|let|class)\b/,
  ]
    .filter((pattern) => pattern.test(declaration))
    .map((pattern) => String(pattern))

  if (violations.length > 0) {
    console.error('✗ Generated declaration declares a runtime VALUE — it must be types-only.')
    console.error(`  Matched: ${violations.join(', ')}`)
    console.error('  Fix the emitter (scripts/build/build-types.ts), not this file.')
    process.exit(1)
  }
}

/** Escape a payload for safe interpolation-free embedding in a template literal. */
const escapeForTemplateLiteral = (text: string): string =>
  text.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')

const main = (): void => {
  if (!existsSync(DECLARATION_SOURCE)) {
    console.error(`✗ Missing ${DECLARATION_SOURCE}`)
    console.error('  Run `bun run scripts/build/build-types.ts` first.')
    process.exit(1)
  }

  const body = readFileSync(DECLARATION_SOURCE, 'utf8')

  // Anti-vacuity: an empty or truncated extraction would sail through every
  // predicate below (nothing to match) and ship a declaration that type-checks
  // vacuously — exactly the shape [internal ref]'s misspelled-property
  // half exists to reject.
  if (body.length < 20_000) {
    console.error(`✗ ${DECLARATION_SOURCE} is suspiciously small (${body.length} chars).`)
    console.error('  Type extraction likely failed — re-run build-types.ts and check its output.')
    process.exit(1)
  }
  for (const required of ['AppConfig', 'CodeContext']) {
    if (!body.includes(required)) {
      console.error(`✗ ${DECLARATION_SOURCE} is missing '${required}'.`)
      process.exit(1)
    }
  }

  const declaration = wrapAsAmbientModule(body)
  assertTypesOnly(declaration)

  const header = `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// AUTO-GENERATED by scripts/build/generate-embedded-config-types.ts — DO NOT EDIT.
//
// The payload the \`sovrium types\` command writes into an author's directory:
// an ambient \`declare module 'sovrium'\` declaration plus the minimal
// tsconfig.json that makes it resolvable. Both are inlined as string constants
// so the command works identically in dev and in the compiled binary with no
// filesystem read — see the generator's header for why this is not a
// \`with { type: 'file' }\` embed like its sibling manifests.
//
// Regenerate:
//   bun run scripts/build/build-types.ts
//   bun run scripts/build/generate-embedded-config-types.ts
`

  const contents = `${header}
/** Ambient \`declare module 'sovrium'\` declaration — written as \`sovrium.d.ts\`. */
export const CONFIG_TYPES_DECLARATION: string = \`${escapeForTemplateLiteral(declaration)}\`

/** Minimal tsconfig.json — written as \`tsconfig.json\`. Sets no \`include\` by design. */
export const CONFIG_TSCONFIG: string = \`${escapeForTemplateLiteral(TSCONFIG_CONTENT)}\`
`

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, contents)

  console.log(
    `✓ embedded-config-types.generated.ts — declaration ${(declaration.length / 1024).toFixed(1)} KB, tsconfig ${TSCONFIG_CONTENT.length} B`
  )
}

main()
