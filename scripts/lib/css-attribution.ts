/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * CSS attribution: which component TYPES need which Tailwind classes.
 *
 * The native-free compiler inside the binary is candidate-driven, and until
 * issue #199 every app was served the stylesheet of EVERY candidate the source
 * tree holds — 349,833 bytes for a page with one heading. This module computes
 * the map that lets the runtime compile only what an app declares:
 *
 *   - CORE      — classes a page needs whatever components it declares: the
 *                 page shell, the toast/dialog runtime, the synthesized
 *                 `command` palette and `favorites-button`, the types the
 *                 engine's own pages place (default home, not found, error),
 *                 every class a file reached by no component type holds.
 *   - CONSOLE   — classes only the operator console authors (`src/admin/**`,
 *                 `islands/admin/**`, the generated preset). The console is
 *                 served the whole set anyway; keeping its exclusives out of
 *                 CORE is what makes a text-only app small.
 *   - GROUPS    — every other class, keyed by the exact set of types whose
 *                 renderer or island reaches the file that holds it (a FILE
 *                 SIGNATURE). A class reached by `table` and `kanban` sits in
 *                 the `{kanban, table}` group once; the runtime unions the
 *                 groups whose types intersect the app's declared types.
 *
 * Attribution unit: the LEAF MODULE. `COMPONENT_REGISTRY` is spreads of
 * spreads over forty start modules; a key whose value is an imported
 * identifier is attributed to the module that exports it, and a key declared
 * inline is attributed to the module declaring it — so the module's own
 * literals belong to every key it holds, which is the one over-approximation
 * accepted here (measured small: the 34-type SSR group is ~150 classes).
 *
 * Walk: `Bun.Transpiler.scanImports` over static AND dynamic imports (islands
 * lazy-load their panels), resolved through the `@/` alias, confined to
 * `src/presentation/` and stopped at the five hubs that reach everything —
 * the registry, the dispatcher, the island registry, the island client and
 * the view-type island map. Type-only imports are elided by the transpiler,
 * which is what a CSS walk wants: a type carries no class.
 *
 * Why `scanImports` and not `Bun.build` metafile: 0.3 ms a file against 7 ms
 * an entry, and a bundler cannot stop at a node.
 *
 * Templates are NOT scanned: the YAML ones never were, and `app.ts` templates
 * author only `className` / `classes`, which `collectAppCandidates` reads at
 * runtime. The docs and skills payloads are negated: they render as HTML
 * nowhere in this binary.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, posix } from 'node:path'
import { Scanner } from '@tailwindcss/oxide'
import ts from 'typescript'
import { fail, REPO_ROOT, type ComponentCssGroup } from './css-attribution-compile'
import {
  CONSOLE_ISLANDS,
  CONSOLE_PATH_PREFIXES,
  CORE_WALK_BOUNDARY,
  ENGINE_PAGES_FILE,
  ISLANDS_BY_TYPE,
  PAGE_LEVEL_ISLANDS,
  STOP_SET,
  SYNTHESIZED_TYPES_FILE,
} from './css-attribution-tables'
import { toPosixPath } from './posix-path'
import {
  findConstInitializer,
  parseModule,
  resolveImportSpecifier,
  unwrapExpression,
} from './ts-ast-reader'

export {
  CONSOLE_ISLANDS,
  CORE_WALK_BOUNDARY,
  ISLANDS_BY_TYPE,
  PAGE_LEVEL_ISLANDS,
  STOP_SET,
} from './css-attribution-tables'
export * from './css-attribution-compile'

// -----------------------------------------------------------------------------
// Path keys — POSIX separators, always
// -----------------------------------------------------------------------------
//
// Every path this module compares — the walk's visited set, the stop set, the
// boundary, the registry's leaf modules, the island targets, the console
// prefixes — is a key, and a key has ONE spelling: forward slashes. On Windows
// `node:path` joins and resolves with `\` while TypeScript's `sf.fileName`
// and the tables in `css-attribution-tables.ts` carry `/`, so a mixed key set
// misses every lookup: `isPresentationModule` matched nothing, the walk reached
// nothing, and the stale-entry guard on `CORE_WALK_BOUNDARY` fired (the 0.39.0
// Windows binary build). So the root is normalised once, every join is
// `posix.join` over it, and the two producers outside this module's control
// (the import resolver and oxide's file list) are normalised where they enter.
// Windows' file APIs accept forward slashes, so the keys are also valid paths.

const ROOT = toPosixPath(REPO_ROOT)
/** A repo-relative POSIX path (`src/presentation/...`) to its absolute POSIX key. */
export const repoKey = (relPath: string): string => posix.join(ROOT, toPosixPath(relPath))

const SRC = repoKey('src')
const PRESENTATION = posix.join(SRC, 'presentation')
const REGISTRY_DIR = posix.join(PRESENTATION, 'render', 'registry')
const ISLANDS_DIR = posix.join(PRESENTATION, 'islands')

const rel = (path: string): string => posix.relative(ROOT, toPosixPath(path))

// =============================================================================
// Corpus — the per-file candidate scan
// =============================================================================

/**
 * Negated from the `src` scan root. Each is derived data inside `src`, never
 * markup the binary renders, and each would widen the candidate set with its
 * own identifiers: the generator's own output (a self-amplifying loop that
 * once reached 404 MB), the embedded `declare module 'sovrium'` text, the
 * default design's flat view (a duplicate of the generated theme layer, which
 * stays scanned), the `sovrium library` catalogue (copied into an author's
 * config, where `collectAppCandidates` finds it), the in-binary manual and
 * Agent Skills payloads (markdown rendered by nothing here), a booted
 * preview's data directory, and the co-located unit tests.
 */
export const SCAN_NEGATIONS: readonly string[] = [
  'infrastructure/css/generated-css-assets.ts',
  'infrastructure/assets/embedded-config-types.generated.ts',
  'infrastructure/assets/embedded-docs.generated.ts',
  'infrastructure/assets/embedded-docs-behaviour.generated.ts',
  'infrastructure/assets/embedded-skills.generated.ts',
  'domain/models/app/design/default-design.generated.ts',
  'library/**',
  '**/.sovrium/**',
  '**/.sovrium-wt/**',
  '**/*.test.ts',
  '**/*.test.tsx',
]

export interface CorpusFile {
  /** Absolute path. */
  readonly path: string
  /** Every class-shaped token oxide extracts from this file (over-extraction included). */
  readonly candidates: readonly string[]
}

/** The oxide scan of `src`, one entry per file, in path order. */
export const scanCorpus = (): readonly CorpusFile[] => {
  const globbed = new Scanner({
    sources: [
      { base: SRC, pattern: '**/*.{ts,tsx}', negated: false },
      ...SCAN_NEGATIONS.map((pattern) => ({ base: SRC, pattern, negated: true })),
    ],
  })
  // `files` is the list the glob scan resolved (gitignore honoured); scanning
  // each by content gives the same union (proved by the unit test) with the
  // provenance a whole-tree `scan()` throws away.
  //
  // One Scanner PER FILE, never one shared: oxide's `scanFiles` is incremental
  // and returns only candidates that instance has not returned before, so a
  // shared instance credits each class to the first file in path order that
  // holds it (`src/admin/**` sorts first, which once put `rounded-md` and
  // `text-md` in the console-only set and served a text-only page no rule for
  // its skip link). The union is identical either way; the PROVENANCE is not.
  const files = [...globbed.files].map(toPosixPath).toSorted()
  return files.map((path) => ({
    path,
    candidates: new Scanner({ sources: [] }).scanFiles([
      { content: readFileSync(path, 'utf8'), extension: extname(path).slice(1) },
    ]),
  }))
}

// =============================================================================
// Registry keys → leaf modules
// =============================================================================

export interface RegistryKey {
  readonly key: string
  /** Absolute path of the module the key's renderer is attributed to. */
  readonly leafModule: string
}

const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile()

/** {@link resolveImportSpecifier} with its result as a POSIX key (it resolves with `node:path`). */
const resolveImport = (fromFile: string, specifier: string): string | undefined => {
  const target = resolveImportSpecifier(fromFile, specifier, isFile)
  return target === undefined ? undefined : toPosixPath(target)
}

const sourceFileCache = new Map<string, ts.SourceFile>()
const parseFile = (rawPath: string): ts.SourceFile => {
  const path = toPosixPath(rawPath)
  const cached = sourceFileCache.get(path)
  if (cached) return cached
  const sf = parseModule(path, readFileSync(path, 'utf8'))
  sourceFileCache.set(path, sf)
  return sf
}

/** `import { a as b, c } from 'x'` / `import d from 'x'` → local name → module path. */
const importedBindings = (sf: ts.SourceFile): ReadonlyMap<string, string> => {
  const bindings = new Map<string, string>()
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
      continue
    }
    const target = resolveImport(sf.fileName, statement.moduleSpecifier.text)
    if (target === undefined) continue
    const clause = statement.importClause
    if (clause === undefined || clause.isTypeOnly) continue
    if (clause.name) bindings.set(clause.name.text, target)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (!element.isTypeOnly) bindings.set(element.name.text, target)
      }
    }
  }
  return bindings
}

/** The object literal a `const <name> = { … }` holds, through `as` / `satisfies`. */
const objectLiteralOf = (sf: ts.SourceFile, name: string): ts.ObjectLiteralExpression => {
  const initializer = findConstInitializer(sf, name)
  if (initializer === undefined) return fail(`const '${name}' not found in ${rel(sf.fileName)}`)
  const literal = unwrapExpression(initializer)
  if (!ts.isObjectLiteralExpression(literal)) {
    return fail(`const '${name}' in ${rel(sf.fileName)} is not an object literal`)
  }
  return literal
}

const keysOfLiteral = (
  sf: ts.SourceFile,
  literal: ts.ObjectLiteralExpression,
  depth: number
): readonly RegistryKey[] => {
  if (depth > 8) return fail(`registry spread nesting deeper than 8 at ${rel(sf.fileName)}`)
  const bindings = importedBindings(sf)
  return literal.properties.flatMap((property): readonly RegistryKey[] => {
    if (ts.isSpreadAssignment(property)) {
      const spread = unwrapExpression(property.expression)
      if (!ts.isIdentifier(spread)) return fail(`non-identifier spread in ${rel(sf.fileName)}`)
      const module = bindings.get(spread.text) ?? sf.fileName
      spreadModules.add(module)
      const target = parseFile(module)
      return keysOfLiteral(target, objectLiteralOf(target, spread.text), depth + 1)
    }
    const { name } = property
    if (name === undefined || !(ts.isIdentifier(name) || ts.isStringLiteralLike(name))) {
      return fail(`computed registry key in ${rel(sf.fileName)}`)
    }
    const key = name.text
    if (ts.isPropertyAssignment(property)) {
      const value = unwrapExpression(property.initializer)
      if (ts.isIdentifier(value)) {
        return [{ key, leafModule: bindings.get(value.text) ?? sf.fileName }]
      }
      return [{ key, leafModule: sf.fileName }]
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      return [{ key, leafModule: bindings.get(key) ?? sf.fileName }]
    }
    return [{ key, leafModule: sf.fileName }]
  })
}

export interface Registry {
  readonly keys: readonly RegistryKey[]
  /**
   * Modules visited only to resolve a spread and attributed no key of their
   * own (`island-components.tsx` is four spreads and nothing else). They reach
   * every module they spread, so a walk must not enter them: they join the
   * stop set, and their own literals (none, in practice) are CORE.
   */
  readonly containerModules: readonly string[]
}

const spreadModules = new Set<string>()

/** Every `COMPONENT_REGISTRY` key with the module its renderer is attributed to. */
export const readRegistry = (): Registry => {
  const registry = posix.join(REGISTRY_DIR, 'component-registry.ts')
  const sf = parseFile(registry)
  spreadModules.clear()
  // Object-spread semantics: a key declared twice (`accordion` is in the
  // structural AND the island-form module) is the LAST one at runtime.
  const byKey = new Map<string, RegistryKey>()
  for (const entry of keysOfLiteral(sf, objectLiteralOf(sf, 'COMPONENT_REGISTRY'), 0)) {
    byKey.set(entry.key, entry)
  }
  const keys = [...byKey.values()]
  if (keys.length < 80) return fail(`only ${keys.length} registry keys read; the spread walk broke`)
  const leaves = new Set(keys.map((entry) => entry.leafModule))
  const containerModules = [...spreadModules]
    .filter((module) => !leaves.has(module) && module !== registry)
    .toSorted()
  return { keys, containerModules }
}

/** The `SYNTHESIZED_COMPONENT_TYPES` set, read from its source. */
export const readSynthesizedTypes = (): ReadonlySet<string> => {
  const sf = parseFile(repoKey(SYNTHESIZED_TYPES_FILE))
  const initializer = findConstInitializer(sf, 'SYNTHESIZED_COMPONENT_TYPES')
  if (initializer === undefined) return fail('SYNTHESIZED_COMPONENT_TYPES not found')
  const call = unwrapExpression(initializer)
  const [argument] = ts.isNewExpression(call) ? (call.arguments ?? []) : []
  if (argument === undefined || !ts.isArrayLiteralExpression(argument)) {
    return fail('SYNTHESIZED_COMPONENT_TYPES is not `new Set([…])`')
  }
  const names = argument.elements.filter(ts.isStringLiteralLike).map((e) => e.text)
  if (names.length === 0) return fail('SYNTHESIZED_COMPONENT_TYPES is empty')
  return new Set(names)
}

/**
 * The component types the engine's own pages (default home, not found, error)
 * place through the dispatcher: every `type: '<literal>'` property assignment
 * in {@link ENGINE_PAGES_FILE}, across every function in it.
 */
export const readEnginePageTypes = (registryKeys?: ReadonlySet<string>): ReadonlySet<string> => {
  const sf = parseFile(repoKey(ENGINE_PAGES_FILE))
  const types = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      node.name.text === 'type' &&
      ts.isStringLiteralLike(node.initializer)
    ) {
      types.add(node.initializer.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  if (types.size < 3)
    return fail(`only ${types.size} engine-page type(s) read from ${ENGINE_PAGES_FILE}`)
  const keys = registryKeys ?? new Set(readRegistry().keys.map((entry) => entry.key))
  for (const type of types) {
    if (!keys.has(type)) fail(`engine-page type '${type}' is not a registry key`)
  }
  return types
}

// =============================================================================
// Island loaders → entry modules
// =============================================================================

export interface IslandLoader {
  readonly key: string
  /** Absolute path of the island's entry module. */
  readonly target: string
}

/** The string literal a `() => import('…')` arrow loads, or undefined. */
const dynamicImportTarget = (node: ts.Node, from: string): string | undefined => {
  const body = ts.isArrowFunction(node) ? unwrapExpression(node.body as ts.Expression) : node
  if (!ts.isCallExpression(body) || body.expression.kind !== ts.SyntaxKind.ImportKeyword) {
    return undefined
  }
  const [specifier] = body.arguments
  if (specifier === undefined || !ts.isStringLiteralLike(specifier)) return undefined
  return resolveImport(from, specifier.text)
}

/** `const loadX = () => import('…')` and `export const XLazy = lazy(() => import('…'))`. */
const loaderConstsOf = (sf: ts.SourceFile): ReadonlyMap<string, string> => {
  const loaders = new Map<string, string>()
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue
      const init = unwrapExpression(declaration.initializer)
      const direct = dynamicImportTarget(init, sf.fileName)
      if (direct !== undefined) {
        loaders.set(declaration.name.text, direct)
        continue
      }
      if (ts.isCallExpression(init) && init.arguments[0] !== undefined) {
        const inner = dynamicImportTarget(unwrapExpression(init.arguments[0]), sf.fileName)
        if (inner !== undefined) loaders.set(declaration.name.text, inner)
      }
    }
  }
  return loaders
}

/**
 * Every `ISLANDS` key with the module its loader imports, parsed from the
 * three literal shapes the registry uses — `lazy(() => import('…'))`,
 * `lazy(loadX)` over a top-level `const loadX = () => import('…')`, and an
 * imported identifier (a `*Lazy` from `view-type-islands.ts`, or an eager
 * default import). Parsed, never imported: the registry eagerly imports an
 * island that touches `document` at module scope.
 */
export const readIslandLoaders = (): readonly IslandLoader[] => {
  const registryPath = posix.join(ISLANDS_DIR, 'island-registry.ts')
  const sf = parseFile(registryPath)
  const localLoaders = loaderConstsOf(sf)
  const bindings = importedBindings(sf)
  const resolveIdentifier = (name: string): string | undefined => {
    const local = localLoaders.get(name)
    if (local !== undefined) return local
    const module = bindings.get(name)
    if (module === undefined) return undefined
    // A default import of the island itself (eager), or a named export that
    // is itself a `lazy(() => import('…'))` in the exporting module.
    const exported = loaderConstsOf(parseFile(module)).get(name)
    return exported ?? module
  }
  const literal = objectLiteralOf(sf, 'ISLANDS')
  const loaders = literal.properties.map((property): IslandLoader => {
    if (!ts.isPropertyAssignment(property) || property.name === undefined) {
      return fail('ISLANDS holds a non-assignment property')
    }
    const { name } = property
    if (!(ts.isIdentifier(name) || ts.isStringLiteralLike(name))) {
      return fail('ISLANDS holds a computed key')
    }
    const value = unwrapExpression(property.initializer)
    const target = ts.isIdentifier(value)
      ? resolveIdentifier(value.text)
      : ts.isCallExpression(value) && value.arguments[0] !== undefined
        ? (() => {
            const argument = unwrapExpression(value.arguments[0])
            return ts.isIdentifier(argument)
              ? resolveIdentifier(argument.text)
              : dynamicImportTarget(argument, registryPath)
          })()
        : undefined
    if (target === undefined) {
      return fail(`ISLANDS key '${name.text}' has a loader shape this reader does not know`)
    }
    return { key: name.text, target }
  })
  if (loaders.length < 50) return fail(`only ${loaders.length} ISLANDS keys read`)
  return loaders
}

// =============================================================================
// The import walk
// =============================================================================

const transpilers = {
  ts: new Bun.Transpiler({ loader: 'ts' }),
  tsx: new Bun.Transpiler({ loader: 'tsx' }),
}
const importsCache = new Map<string, readonly string[]>()

/**
 * The two stop files that EXPORT loaders: a module importing a named loader
 * from one of them (`loadRichTextCellEditor` from the island registry, a
 * `*Lazy` from the view-type map) reaches that loader's target, not the whole
 * registry — so the import is replaced by the targets it names.
 */
const LOADER_HUBS: readonly string[] = [
  'src/presentation/islands/island-registry.ts',
  'src/presentation/islands/view-type-islands.ts',
]

const namedLoaderTargets = (importer: string, hub: string): readonly string[] => {
  const loaders = loaderConstsOf(parseFile(hub))
  const targets: string[] = []
  for (const statement of parseFile(importer).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
      continue
    }
    if (resolveImport(importer, statement.moduleSpecifier.text) !== hub) continue
    const named = statement.importClause?.namedBindings
    if (named === undefined || !ts.isNamedImports(named)) continue
    for (const element of named.elements) {
      const target = loaders.get((element.propertyName ?? element.name).text)
      if (target !== undefined) targets.push(target)
    }
  }
  return targets
}

/** The modules a file imports, statically or dynamically, resolved and inside the repo. */
export const importsOf = (path: string): readonly string[] => {
  const cached = importsCache.get(path)
  if (cached) return cached
  const loader = path.endsWith('.tsx') ? transpilers.tsx : transpilers.ts
  const hubs = new Set(LOADER_HUBS.map((path) => repoKey(path)))
  const resolved = loader.scanImports(readFileSync(path, 'utf8')).flatMap(({ path: specifier }) => {
    const target = resolveImport(path, specifier)
    if (target === undefined) return []
    return hubs.has(target) ? [target, ...namedLoaderTargets(path, target)] : [target]
  })
  importsCache.set(path, resolved)
  return resolved
}

const isPresentationModule = (path: string): boolean =>
  path.startsWith(`${PRESENTATION}/`) &&
  !path.endsWith('.d.ts') &&
  !/\.test\.tsx?$/.test(basename(path))

/**
 * Every presentation module reachable from `roots` without crossing a stop
 * file or leaving `src/presentation/`. Roots are included when they qualify.
 */
export const walkPresentation = (
  roots: readonly string[],
  stop: ReadonlySet<string>
): ReadonlySet<string> => {
  const reached = new Set<string>()
  const queue = roots
    .map(toPosixPath)
    .filter((root) => isPresentationModule(root) && !stop.has(root))
  for (const next of queue) reached.add(next)
  while (queue.length > 0) {
    const current = queue.pop() as string
    for (const target of importsOf(current)) {
      if (reached.has(target) || stop.has(target) || !isPresentationModule(target)) continue
      reached.add(target)
      queue.push(target)
    }
  }
  return reached
}

// =============================================================================
// Attribution
// =============================================================================

const CORE = 'CORE'
const CONSOLE = 'CONSOLE'

export interface Attribution {
  readonly core: readonly string[]
  readonly console: readonly string[]
  readonly groups: readonly ComponentCssGroup[]
  /** Every registry key, synthesized ones included. */
  readonly attributedTypes: readonly string[]
  readonly stats: {
    readonly corpusFiles: number
    readonly presentationFiles: number
    readonly typeReachedFiles: number
    readonly coreFiles: number
    readonly consoleFiles: number
    readonly keptCandidates: number
    readonly droppedCandidates: number
  }
}

const underConsolePrefix = (path: string): boolean =>
  CONSOLE_PATH_PREFIXES.some((prefix) => rel(path).startsWith(prefix))

/** Assert the three island hand tables partition `ISLANDS` exactly. */
export const assertIslandTablesPartition = (
  loaders: readonly IslandLoader[],
  registryKeys: ReadonlySet<string>
): void => {
  const islandKeys = new Set(loaders.map((loader) => loader.key))
  const claimedBy = new Map<string, string>()
  const claim = (key: string, table: string): void => {
    if (!islandKeys.has(key)) fail(`${table} names '${key}', which is not an ISLANDS key`)
    const previous = claimedBy.get(key)
    if (previous !== undefined && previous !== table) {
      fail(`ISLANDS key '${key}' is claimed by both ${previous} and ${table}`)
    }
    claimedBy.set(key, table)
  }
  for (const [type, keys] of Object.entries(ISLANDS_BY_TYPE)) {
    if (!registryKeys.has(type)) fail(`ISLANDS_BY_TYPE names '${type}', not a registry key`)
    for (const key of keys) claim(key, 'ISLANDS_BY_TYPE')
  }
  for (const key of PAGE_LEVEL_ISLANDS) claim(key, 'PAGE_LEVEL_ISLANDS')
  for (const key of CONSOLE_ISLANDS) claim(key, 'CONSOLE_ISLANDS')
  const unclaimed = [...islandKeys].filter((key) => !claimedBy.has(key)).toSorted()
  if (unclaimed.length > 0) {
    fail(
      `ISLANDS key(s) claimed by no table: ${unclaimed.join(', ')} — add each to ISLANDS_BY_TYPE, PAGE_LEVEL_ISLANDS or CONSOLE_ISLANDS`
    )
  }
}

/**
 * Attribute every kept candidate to CORE, CONSOLE or one file-signature group.
 *
 * `keep` is the junk filter (parseable under some design, or a raw `--*`
 * token); `extraCore` are classes with no file provenance (the arbitrary-var
 * safelist) that join CORE.
 */
export const attributeCorpus = (
  corpus: readonly CorpusFile[],
  keep: (candidate: string) => boolean,
  extraCore: readonly string[]
): Attribution => {
  const { keys: registry, containerModules } = readRegistry()
  const registryKeys = new Set(registry.map((entry) => entry.key))
  const synthesized = readSynthesizedTypes()
  for (const type of synthesized) {
    if (!registryKeys.has(type)) fail(`synthesized type '${type}' is not a registry key`)
  }
  const enginePageTypes = readEnginePageTypes(registryKeys)
  const loaders = readIslandLoaders()
  assertIslandTablesPartition(loaders, registryKeys)
  const islandTarget = new Map(loaders.map((loader) => [loader.key, loader.target] as const))
  const stop = new Set([...STOP_SET.map((path) => repoKey(path)), ...containerModules])

  const marks = new Map<string, Set<string>>()
  const mark = (files: Iterable<string>, label: string): void => {
    for (const file of files) {
      const set = marks.get(file) ?? new Set<string>()
      set.add(label)
      marks.set(file, set)
    }
  }
  const targetsOf = (keys: readonly string[]): readonly string[] =>
    keys.map((key) => islandTarget.get(key) ?? fail(`no island target for '${key}'`))

  // 1. Type walks — the renderer's leaf module plus the islands it mounts.
  for (const { key, leafModule } of registry) {
    if (stop.has(leafModule)) {
      fail(`registry key '${key}' resolves to the stop file ${rel(leafModule)} — no leaf module`)
    }
    const roots = [leafModule, ...targetsOf(ISLANDS_BY_TYPE[key] ?? [])]
    const core = synthesized.has(key) || enginePageTypes.has(key)
    mark(walkPresentation(roots, stop), core ? CORE : key)
  }
  // 2. Page-level islands → CORE; console islands and console paths → CONSOLE.
  mark(walkPresentation(targetsOf(PAGE_LEVEL_ISLANDS), stop), CORE)
  mark(walkPresentation(targetsOf(CONSOLE_ISLANDS), stop), CONSOLE)
  for (const file of corpus) if (underConsolePrefix(file.path)) mark([file.path], CONSOLE)
  // 3. Everything else reached by no type is a CORE root: the page shell, the
  //    resolvers, the API routes — and what they import is CORE too, even when
  //    a type also reaches it (a shared recipe the shell uses must always ship).
  const boundary = CORE_WALK_BOUNDARY.map((path) => repoKey(path))
  for (const path of boundary) {
    const labels = marks.get(path)
    if (labels === undefined || ![...labels].some((label) => label !== CORE && label !== CONSOLE)) {
      fail(`CORE_WALK_BOUNDARY entry ${rel(path)} is reached by no component type — stale entry`)
    }
  }
  const coreRoots = corpus
    .map((file) => file.path)
    .filter((path) => isPresentationModule(path) && !marks.has(path) && !stop.has(path))
  mark(walkPresentation(coreRoots, new Set([...stop, ...boundary])), CORE)
  const marksOf = (path: string): ReadonlySet<string> =>
    marks.get(path) ??
    (stop.has(path) || !isPresentationModule(path)
      ? new Set([CORE])
      : fail(`unmarked presentation file ${rel(path)}`))

  // 4. Per class: the union of the marks of every file holding it.
  const classMarks = new Map<string, Set<string>>()
  let dropped = 0
  for (const file of corpus) {
    const fileMarks = marksOf(file.path)
    for (const candidate of file.candidates) {
      if (!keep(candidate)) {
        dropped += 1
        continue
      }
      const set = classMarks.get(candidate) ?? new Set<string>()
      for (const label of fileMarks) set.add(label)
      classMarks.set(candidate, set)
    }
  }
  for (const candidate of extraCore) {
    const set = classMarks.get(candidate) ?? new Set<string>()
    set.add(CORE)
    classMarks.set(candidate, set)
  }

  const core: string[] = []
  const consoleOnly: string[] = []
  const groupsBySignature = new Map<string, { types: readonly string[]; classes: string[] }>()
  for (const [candidate, labels] of classMarks) {
    if (labels.has(CORE)) {
      core.push(candidate)
      continue
    }
    const types = [...labels].filter((label) => label !== CONSOLE).toSorted()
    if (types.length === 0) {
      consoleOnly.push(candidate)
      continue
    }
    const signature = types.join('\u0000')
    const group = groupsBySignature.get(signature) ?? { types, classes: [] }
    group.classes.push(candidate)
    groupsBySignature.set(signature, group)
  }
  const groups = [...groupsBySignature.values()]
    .map((group) => ({ types: group.types, classes: group.classes.toSorted() }))
    .toSorted((a, b) => a.types.join(' ').localeCompare(b.types.join(' ')))
  for (const group of groups) {
    const leaked = group.types.filter((type) => synthesized.has(type))
    if (leaked.length > 0) fail(`synthesized type(s) ${leaked.join(', ')} outside CORE`)
    const enginePage = group.types.filter((type) => enginePageTypes.has(type))
    if (enginePage.length > 0) fail(`engine-page type(s) ${enginePage.join(', ')} outside CORE`)
  }

  const typeReachedFiles = [...marks].filter(([, labels]) =>
    [...labels].some((label) => label !== CORE && label !== CONSOLE)
  ).length
  return {
    core: core.toSorted(),
    console: consoleOnly.toSorted(),
    groups,
    attributedTypes: [...registryKeys].toSorted(),
    stats: {
      corpusFiles: corpus.length,
      presentationFiles: corpus.filter((file) => isPresentationModule(file.path)).length,
      typeReachedFiles,
      coreFiles: [...marks].filter(([, labels]) => labels.has(CORE)).length,
      consoleFiles: [...marks].filter(([, labels]) => labels.has(CONSOLE)).length,
      keptCandidates: classMarks.size,
      droppedCandidates: dropped,
    },
  }
}
