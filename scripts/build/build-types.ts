/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build Types Script — emits the config-type declaration the binary embeds.
 *
 * Uses TypeScript's Compiler API to resolve Effect Schema types into plain
 * structural types, producing a zero-dependency `.d.ts` that needs no 'effect'
 * install. Its output is the ONLY input to
 * `scripts/build/generate-embedded-config-types.ts`, which wraps it as
 * `declare module 'sovrium'` and inlines it into
 * `src/infrastructure/assets/embedded-config-types.generated.ts` — the string
 * `sovrium types` writes to a user's `sovrium.d.ts`.
 *
 * So this is not "what npm consumers get". Nothing is published to npm; this is
 * what EVERY TypeScript config author gets, and the only surface they can import.
 *
 * Approach:
 *   1. Build a ts.Program over the ROOT tsconfig
 *   2. Extract resolved structural types for the TYPE_EXPORTS aliases, read off
 *      `src/index.ts` — the same file the in-repo `sovrium` path alias targets,
 *      so the emitted surface and the in-repo one cannot drift apart
 *   3. Append the hand-written `CodeContext` (it is an interface; see the note on
 *      the `lines.push` block for why it cannot be extracted structurally)
 *   4. Emit a single `.d.ts` to `tmp/`, gitignored — it is a build intermediate,
 *      not an artifact; the committed artifact is the generated .ts above
 *
 * TYPES-ONLY IS LOAD-BEARING, NOT STYLISTIC
 * -----------------------------------------
 * The binary leaves bare-package specifiers UNRESOLVED at runtime, while
 * `import type` is erased before it ever looks. So a declaration exporting a
 * `defineConfig` helper type-checks clean (tsc exit 0) and then fails at boot
 * (binary exit 1) with `Cannot find package` — a type-checks-then-dies trap,
 * strictly worse than a plain failure because it defers the error past the point
 * where the author is looking. That is the defect that retired the npm package.
 * Keeping values out makes a value import unreachable BY CONSTRUCTION: it fails
 * type-check for the ordinary reason that no such export exists.
 *
 * Enforced by `verify` below, by `[internal ref]`
 * over the wrapped payload, by `[internal ref]` over
 * the consumers, and pinned end-to-end by [internal ref].
 *
 * Usage:
 *   bun run scripts/build/build-types.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { escapeRegExp } from '@/domain/kernel/sanitize/escape-regexp'
import { printStderr } from '@/infrastructure/logging/cli-output'

/**
 * The one typed failure this script raises.
 *
 * This module spawns no process, does no network egress, and holds no scoped
 * resource — SC1 keeps it plain synchronous TypeScript rather than an
 * `Effect.gen` program. What it still owes SC4 is a SINGLE `process.exit`
 * site: every internal failure used to call `printStderr` and `process.exit(1)`
 * at its own call site (nine of them), which meant a failure three frames deep
 * inside `extractTypes()` exited the process from inside a function whose
 * return type promised a `string`. Each of those sites now throws this class
 * instead, with the identical message, and `main()` is the only place that
 * turns one into a `process.exit(1)` — the "typed failure channel" without
 * paying for an Effect runtime that finds no process, egress or scope to earn
 * its keep here.
 */
class BuildTypesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BuildTypesError'
  }
}

const PROJECT_ROOT = join(import.meta.dir, '..', '..')

/**
 * Build intermediate, not an artifact — `tmp/` is gitignored, tsconfig-excluded
 * and ESLint-ignored, so nothing downstream mistakes it for shipped output.
 *
 * Deliberately NOT under `dist/`: `scripts/build/build.ts` calls `clean()` on that
 * directory and would delete this file mid-build.
 */
const OUT_DIR = join(PROJECT_ROOT, 'tmp')
const OUT_FILE = join(OUT_DIR, 'config-types.d.ts')

/**
 * The name given to the hoisted per-component style shape.
 *
 * It matches the `identifier` annotation on `ComponentStyleSchema`, so the
 * emitted declaration and the published JSON Schema (`$defs.ComponentStyle`)
 * call the same shape by the same name. Changing one without the other is not
 * caught by anything — they are two independent renderings of one schema.
 */
const COMPONENT_STYLE_TYPE_NAME = 'ComponentStyle'

// Types to extract from src/index.ts
const TYPE_EXPORTS = [
  { exported: 'AppConfig', source: 'AppConfig' },
  { exported: 'PageConfig', source: 'PageConfig' },
  { exported: 'TableConfig', source: 'TableConfig' },
  { exported: 'ComponentConfig', source: 'ComponentConfig' },
  { exported: 'ThemeConfig', source: 'ThemeConfig' },
  { exported: 'DesignConfig', source: 'DesignConfig' },
  { exported: 'AuthConfig', source: 'AuthConfig' },
  { exported: 'LanguageConfig', source: 'LanguageConfig' },
  { exported: 'AnalyticsConfig', source: 'AnalyticsConfig' },
  { exported: 'AutomationConfig', source: 'AutomationConfig' },
  { exported: 'ConnectionConfig', source: 'ConnectionConfig' },
  { exported: 'FormConfig', source: 'FormConfig' },
  { exported: 'EnvConfig', source: 'EnvConfig' },
  { exported: 'StartOptions', source: 'StartOptions' },
  { exported: 'GenerateStaticOptions', source: 'GenerateStaticOptions' },
  // `source` must be the name EXPORTED BY src/index.ts (the extractor does
  // `exports.find((e) => e.getName() === source)`), not the domain-side name.
  { exported: 'AgentConfig', source: 'AgentConfig' },
  { exported: 'ActionTemplate', source: 'ActionTemplate' },
] as const

// ---------------------------------------------------------------------------
// Repeated-shape hoisting
// ---------------------------------------------------------------------------

/**
 * WHY THE EMITTER HOISTS A SHAPE INSTEAD OF LETTING TYPESCRIPT NAME IT
 * --------------------------------------------------------------------
 * `checker.typeToString` DOES print a type by name — but only when the printed
 * `ts.Type` carries an `aliasSymbol`, which happens when the type reached the
 * printer through a source-level type REFERENCE. Nothing under `AppConfig` does:
 * every property below the top level is computed by Effect Schema's mapped
 * `Schema.Schema.Type<…>` extraction, which yields fresh anonymous object types.
 * So the printer expands them structurally, once per occurrence.
 *
 * That is normally invisible. It stopped being invisible when `design.components`
 * became a closed `Schema.Struct` over the 85 engine component types, each
 * `Schema.optional(ComponentStyleSchema)`: ONE shape, printed 170 times (85 keys
 * x `AppConfig` and `DesignConfig`), which more than doubled the declaration the
 * binary embeds and `sovrium types` writes. The published JSON Schema does not
 * pay this — it emits `ComponentStyle` once behind a `$ref`.
 *
 * Three routes were considered:
 *
 *   1. Give the schema a nominal anchor — a hand-written `interface ComponentStyle`
 *      the schema const is annotated with. That WOULD make the printer name it
 *      everywhere, but it duplicates the shape by hand in the domain model, which
 *      is a drift source with no gate on it. Rejected.
 *   2. Print the shape independently and substitute it. Rejected because it does
 *      not work: the printer's MEMBER ORDER is context-dependent. Printing the
 *      same `ComponentStyle` from the `DesignComponents` alias yields `parts`
 *      first, from `DesignConfig['components']` yields `replace` first, and the
 *      `states` members reorder too — measured, and the reason this code mines the
 *      canonical text out of its OWN output rather than re-deriving it.
 *   3. Hoist the emitted bytes. What this does.
 *
 * The hoist is text-level but not blind: the key list is derived from the checker,
 * the canonical block is taken from the emitted text, and the result is asserted
 * key by key (`assertEveryKeyHoisted`). A shape that is not uniform across the 85
 * keys fails the build rather than half-collapsing.
 */

/**
 * Collapse every run of 2+ spaces to one.
 *
 * The printer emits each type on ONE line and expresses nesting purely as runs
 * of spaces, so this is exactly "ignore the depth this shape happens to sit at".
 * Single spaces are token separators and are preserved.
 */
export const normalizePrintedIndentation = (text: string): string => text.replace(/ {2,}/g, ' ')

/**
 * The balanced `{ … }` block immediately following `marker`, or `undefined` when
 * the marker is absent or is not followed by an object type.
 */
export const readPrintedTypeBlock = (text: string, marker: string): string | undefined => {
  const at = text.indexOf(marker)
  if (at === -1) return undefined

  const open = at + marker.length
  if (text[open] !== '{') return undefined

  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    const char = text[i]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(open, i + 1)
    }
  }
  return undefined
}

/**
 * Re-indent a block captured at some nesting depth so it reads as a top-level
 * type alias body.
 *
 * The run immediately before the block's own closing brace IS its nesting
 * depth, so subtracting that run's width from every run puts the block at
 * column zero. One space is always kept, because the printer's runs double as
 * token separators.
 */
export const dedentPrintedType = (block: string): string => {
  const outdent = / +(?=\}$)/.exec(block)?.[0]?.length ?? 0
  return outdent === 0
    ? block
    : block.replace(/ {2,}/g, (run) => ' '.repeat(Math.max(1, run.length - outdent)))
}

/**
 * A matcher for `block` that tolerates the indentation depth it is printed at.
 *
 * Every run of 2+ spaces becomes ` {2,}`; everything else is matched literally.
 * Loosening only the indentation is what makes one canonical block match the
 * same shape wherever it appears — the two live depths differ by 4 spaces per
 * run — without ever matching a genuinely different type.
 */
export const printedTypeOccurrenceMatcher = (block: string): RegExp => {
  const pattern = block.split(/ {2,}/).map(escapeRegExp).join(' {2,}')
  // Every segment goes through the canonical `escapeRegExp`; the only unescaped
  // text is the ` {2,}` this function writes itself. The rule cannot see that,
  // because the escaping is not the OUTERMOST expression — it sits under a
  // `.map(…).join(…)`. Backtracking is bounded too: each ` {2,}` is followed by
  // a literal non-space character, so the quantifiers cannot overlap.
  // eslint-disable-next-line sovrium/no-dynamic-regexp -- fully escaped above, not an injection sink
  return new RegExp(pattern, 'g')
}

/** The two spellings a printed optional property key can take. */
const optionalKeyMarkers = (key: string): readonly string[] => [
  `readonly ${key}?: `,
  `readonly "${key}"?: `,
]

export interface HoistResult {
  /** The rewritten type strings, in the order they were given. */
  readonly texts: readonly string[]
  /** The hoisted shape, re-indented for a top-level alias. */
  readonly body: string
  readonly replacements: number
  readonly bytesSaved: number
}

/**
 * Replace every printed occurrence of one repeated shape with a reference to
 * `name`, and return the shape so the caller can declare it once.
 *
 * `propertyKeys` is both the anchor (the first key whose value is an object type
 * supplies the canonical bytes) and the proof: after rewriting, EVERY key must
 * name `name`. A key left expanded means the keys do not in fact share one
 * shape, which invalidates the single hoisted alias — so it throws rather than
 * shipping a declaration where 84 keys are named and one silently is not.
 *
 * Throws when the anchor cannot be found or fewer than two occurrences were
 * replaced; the caller decides whether the feature is present at all.
 */
export const hoistPrintedType = (
  texts: readonly string[],
  propertyKeys: readonly string[],
  name: string
): HoistResult => {
  const anchor = propertyKeys
    .flatMap((key) => optionalKeyMarkers(key))
    .flatMap((marker) => texts.flatMap((text) => readPrintedTypeBlock(text, marker) ?? []))
    .at(0)

  if (anchor === undefined) {
    throw new Error(
      `Cannot hoist '${name}': no object type follows any of the ${propertyKeys.length} keys`
    )
  }

  const matcher = printedTypeOccurrenceMatcher(anchor)
  let replacements = 0
  let bytesSaved = 0
  const rewritten = texts.map((text) =>
    text.replace(matcher, (match) => {
      replacements += 1
      bytesSaved += match.length - name.length
      return name
    })
  )

  if (replacements < 2) {
    throw new Error(
      `Cannot hoist '${name}': only ${replacements} occurrence(s) — a named alias would cost bytes rather than save them`
    )
  }

  const notHoisted = propertyKeys.filter(
    (key) =>
      !rewritten.some((text) =>
        optionalKeyMarkers(key).some((marker) => text.includes(`${marker}${name}`))
      )
  )
  if (notHoisted.length > 0) {
    throw new Error(
      `Cannot hoist '${name}': ${notHoisted.length} of ${propertyKeys.length} keys print a DIFFERENT shape ` +
        `(${notHoisted.slice(0, 5).join(', ')}${notHoisted.length > 5 ? ', …' : ''}). ` +
        'The keys no longer share one type, so one alias cannot stand for all of them.'
    )
  }

  return { texts: rewritten, body: dedentPrintedType(anchor), replacements, bytesSaved }
}

// ---------------------------------------------------------------------------
// Type Extraction via TypeScript Compiler API
// ---------------------------------------------------------------------------

function extractTypes(): string {
  console.log('\nExtracting types via TypeScript Compiler API')

  const configPath = join(PROJECT_ROOT, 'tsconfig.json')
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, PROJECT_ROOT)

  const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options)
  const checker = program.getTypeChecker()

  // Find the main entry file
  const entryFile = program.getSourceFile(join(PROJECT_ROOT, 'src', 'index.ts'))
  if (!entryFile) {
    throw new BuildTypesError('Could not find src/index.ts')
  }

  const moduleSymbol = checker.getSymbolAtLocation(entryFile)
  if (!moduleSymbol) {
    throw new BuildTypesError('Could not get module symbol for src/index.ts')
  }

  const exports = checker.getExportsOfModule(moduleSymbol)

  /**
   * Expand an exported type alias of `src/index.ts` to its structural text.
   *
   * Shared by the TYPE_EXPORTS loop and by the `CodeContext.actions` splice
   * below, so the emitted declaration and the in-repo type cannot disagree:
   * both are this one type, printed once.
   */
  const expandExport = (name: string): string => {
    const sym = exports.find((e) => e.getName() === name)
    if (!sym) {
      throw new BuildTypesError(`Type '${name}' not found in src/index.ts exports`)
    }
    let resolved = checker.getDeclaredTypeOfSymbol(sym)
    if (sym.flags & ts.SymbolFlags.TypeAlias) {
      const aliasDecl = sym.declarations?.[0]
      if (aliasDecl && ts.isTypeAliasDeclaration(aliasDecl)) {
        resolved = checker.getTypeAtLocation(aliasDecl)
      }
    }
    return checker.typeToString(
      resolved,
      entryFile,
      ts.TypeFormatFlags.NoTruncation |
        ts.TypeFormatFlags.MultilineObjectLiterals |
        ts.TypeFormatFlags.UseFullyQualifiedType |
        ts.TypeFormatFlags.InTypeAlias |
        ts.TypeFormatFlags.WriteArrayAsGenericType
    )
  }

  /**
   * The engine component types `design.components` is keyed by, read off the
   * checker rather than imported from the domain model — so the emitter cannot
   * fall behind a key that was added or removed.
   *
   * Returns an empty list when the key is absent, which the caller treats as
   * "nothing to hoist" rather than as a failure: a declaration without
   * `design.components` is simply the pre-2026-09 shape, not a broken build.
   */
  const designComponentKeys = (): readonly string[] => {
    const sym = exports.find((e) => e.getName() === 'DesignConfig')
    if (!sym) return []

    let design = checker.getDeclaredTypeOfSymbol(sym)
    const decl = sym.declarations?.[0]
    if (decl && ts.isTypeAliasDeclaration(decl)) design = checker.getTypeAtLocation(decl)

    const componentsProp = checker.getPropertyOfType(design, 'components')
    if (!componentsProp) return []

    const componentsType = checker.getTypeOfSymbolAtLocation(componentsProp, entryFile)
    const defined = componentsType.isUnion()
      ? (componentsType.types.find((t) => (t.flags & ts.TypeFlags.Undefined) === 0) ??
        componentsType)
      : componentsType

    return checker.getPropertiesOfType(defined).map((p) => p.getName())
  }

  const collected = TYPE_EXPORTS.flatMap(({ exported, source }) => {
    const sym = exports.find((e) => e.getName() === source)
    if (!sym) {
      printStderr(`  Type '${source}' not found in src/index.ts exports, skipping`)
      return []
    }
    return [{ exported, typeString: expandExport(source) }]
  })

  const componentKeys = designComponentKeys()
  const hoisted =
    componentKeys.length >= 2
      ? hoistPrintedType(
          collected.map((c) => c.typeString),
          componentKeys,
          COMPONENT_STYLE_TYPE_NAME
        )
      : undefined

  if (hoisted === undefined) {
    printStderr('  design.components absent — nothing to hoist')
  } else {
    console.log(
      `  ${COMPONENT_STYLE_TYPE_NAME} hoisted — ${hoisted.replacements} occurrence(s) across ` +
        `${componentKeys.length} component key(s), ${(hoisted.bytesSaved / 1024).toFixed(1)} KB saved`
    )
  }

  const emitted = collected.map((entry, index) => ({
    exported: entry.exported,
    typeString: hoisted?.texts[index] ?? entry.typeString,
  }))

  const lines: string[] = []

  lines.push('// Auto-generated by scripts/build/build-types.ts — DO NOT EDIT')
  lines.push(
    '// This file contains zero-dependency TypeScript types for Sovrium app configuration.'
  )
  lines.push('')

  if (hoisted !== undefined) {
    lines.push('/**')
    lines.push(` * Styling for ONE engine component type — the value of every key of`)
    lines.push(' * `AppConfig["design"]["components"]`.')
    lines.push(' *')
    lines.push(' * Named rather than inlined at each key on purpose: the shape is identical')
    lines.push(' * for every component type, and expanding it in place is what a structural')
    lines.push(' * type printer does by default. See the hoisting notes in')
    lines.push(' * scripts/build/build-types.ts.')
    lines.push(' */')
    lines.push(`export type ${COMPONENT_STYLE_TYPE_NAME} = ${hoisted.body}`)
    lines.push('')
  }

  for (const { exported, typeString } of emitted) {
    lines.push(`export type ${exported} = ${typeString}`)
    lines.push('')
    console.log(`  ${exported} (${typeString.length} chars)`)
  }

  // Add CodeContext interface (typed parameter for runTypescript code action
  // bodies, validated at server startup). Five properties: inputData,
  // actions, env, log, run. Trigger and step outputs flow in via
  // inputData template references — not directly on context. `log` stays
  // strict so `context.log.<unknown>()` fails type-checking.
  lines.push('/**')
  lines.push(' * CodeContext - typed context object passed to every runTypescript code action.')
  lines.push(' *')
  lines.push(' * Operators MUST annotate execute() as: `function execute(context: CodeContext)`.')
  lines.push(' * The TypeScriptValidator rejects any execute() with an untyped first parameter.')
  lines.push(' *')
  lines.push(' * Trigger payloads and prior step outputs are NOT directly reachable; declare')
  lines.push(' * each value via the action`s `inputData` prop using `{{trigger.data.X}}` /')
  lines.push(' * `{{steps.Y.Z}}` template references. `actions` references reusable templates')
  lines.push(' * at app.actions[] — call by name with input vars.')
  lines.push(' */')
  lines.push('export interface CodeContext {')
  lines.push('  /** Template-resolved key-value pairs declared in the action`s inputData prop */')
  lines.push('  // eslint-disable-next-line @typescript-eslint/no-explicit-any')
  lines.push('  readonly inputData: Record<string, any>')
  // The `actions` surface is CLOSED and derived, not an open index signature.
  //
  // It used to be `{ ref } & Record<string, Record<string, …>>`, which broke
  // against the tsconfig this same pipeline emits: that tsconfig sets
  // `noUncheckedIndexedAccess: true`, so every index-signature hop gained
  // `| undefined` and the documented `context.actions.http.request({…})` failed
  // with TS18048 + TS2722. The open signature also accepted
  // `context.actions.record.lst({})` — a typo — which then failed at runtime.
  //
  // `CodeContextActions` (src/index.ts) derives the families and their props
  // from the automation action schemas, so this text cannot fall behind the
  // engine. `registry-schema-coverage.test.ts` already pins the schema against
  // the runtime handler registry in both directions, which closes the chain
  // from "what this type advertises" to "what dispatch actually accepts" —
  // no additional gate is needed here.
  lines.push('  /**')
  lines.push(
    '   * Two-shape callable surface: actions.ref(<template>, vars) or actions.<type>.<op>(props).'
  )
  lines.push('   *')
  lines.push('   * Three members are typed but do NOT work from a code body, because the sandbox')
  lines.push('   * sub-run-context omits fields the top-level step context sets:')
  lines.push('   *   - `automation.call` ALWAYS REJECTS (no `invokeAutomation` in scope)')
  lines.push('   *   - `filter.continue` is a silent no-op (resolves undefined; the halt is lost)')
  lines.push('   *   - `flow.stop` is inert (its responseOverride/returnData are discarded)')
  lines.push('   * Everything else dispatches normally.')
  lines.push('   */')
  lines.push('  // eslint-disable-next-line @typescript-eslint/no-explicit-any')
  lines.push('  readonly actions: {')
  lines.push(
    '    readonly ref: (templateName: string, vars?: Record<string, unknown>) => Promise<any>'
  )
  lines.push(`  } & ${expandExport('CodeContextActions')}`)
  lines.push('  /** Environment variables (values redacted in logs when length >= 8) */')
  lines.push('  readonly env: Record<string, string>')
  // `log` is documented as a no-op deliberately: the sandbox is handed
  // NOOP_LOG and nothing else, so an undocumented `log` surface reads to an
  // npm consumer as working logging that silently swallows every call.
  lines.push('  /**')
  lines.push('   * Structured logging — info/warn/error.')
  lines.push('   *')
  lines.push('   * NOT YET WIRED: all three methods currently DISCARD their arguments. The')
  lines.push('   * sandbox is handed a no-op implementation, so `context.log.info(...)` emits')
  lines.push('   * nothing — not to stdout, not to run history, not to the error tracker.')
  lines.push('   * The surface is typed and stable so code actions can call it today and')
  lines.push('   * start producing output when a real sink lands. Until then, anything a')
  lines.push('   * code action must actually surface belongs in its return value (persisted')
  lines.push('   * as the step output) or in a thrown error.')
  lines.push('   */')
  lines.push('  readonly log: {')
  lines.push('    readonly info: (...args: ReadonlyArray<unknown>) => void')
  lines.push('    readonly warn: (...args: ReadonlyArray<unknown>) => void')
  lines.push('    readonly error: (...args: ReadonlyArray<unknown>) => void')
  lines.push('  }')
  lines.push('  /** Run-scoped metadata — `attempt` is the 1-indexed retry attempt number */')
  lines.push('  readonly run: {')
  lines.push('    readonly attempt: number')
  lines.push('  }')
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

function verify(dtsContent: string): void {
  console.log('\nVerifying outputs')

  // Verify no Effect imports
  if (dtsContent.includes('import') && dtsContent.includes('effect')) {
    throw new BuildTypesError('Generated .d.ts contains Effect references.')
  }

  // Verify key exports
  if (!dtsContent.includes('AppConfig')) {
    throw new BuildTypesError('Missing AppConfig export.')
  }
  // Inverted on purpose (see the file header): a VALUE export in this declaration
  // is the one defect that type-checks clean and dies at boot.
  if (dtsContent.includes('defineConfig')) {
    throw new BuildTypesError('Generated .d.ts declares defineConfig — this package is types-only.')
  }
  if (/export\s+(declare\s+)?(const|function|var|let|class)\b/.test(dtsContent)) {
    throw new BuildTypesError(
      'Generated .d.ts declares a runtime VALUE — this package is types-only.'
    )
  }
  if (!dtsContent.includes('CodeContext')) {
    throw new BuildTypesError('Missing CodeContext export.')
  }

  const dtsSize = Buffer.byteLength(dtsContent, 'utf-8')
  console.log(`  config-types.d.ts: ${(dtsSize / 1024).toFixed(1)} KB`)

  // Warn if suspiciously small (types should be at least a few KB)
  if (dtsSize < 500) {
    throw new BuildTypesError(
      'Generated .d.ts suspiciously small — the types may not have resolved'
    )
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log('Building the sovrium config-type declaration…')

  mkdirSync(OUT_DIR, { recursive: true })

  const dts = extractTypes()
  writeFileSync(OUT_FILE, dts)

  verify(dts)

  console.log(`\nconfig-type declaration built — ${OUT_FILE}`)
  console.log('  Next: bun run scripts/build/generate-embedded-config-types.ts')
}

// Guarded so the pure helpers above can be unit-tested without running a full
// `ts.createProgram` over the repository as an import side effect.
//
// SC4 — this is the ONLY `process.exit` in the file. Every internal failure
// above throws `BuildTypesError` with the message this used to `printStderr`
// itself before exiting; this is the one place that turns it into an exit
// code, so a failure three call-frames deep no longer has to know it is the
// process's exit path.
if (import.meta.main) {
  try {
    main()
  } catch (error) {
    if (error instanceof BuildTypesError) {
      printStderr(error.message)
      process.exit(1)
    }
    throw error
  }
}
