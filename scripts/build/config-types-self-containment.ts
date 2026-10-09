/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Self-containment of the config-type declaration `build-types.ts` emits.
 *
 * `sovrium types` writes that declaration into an author's directory, where no
 * package is installed and no `@/` path alias exists, under a tsconfig with
 * `skipLibCheck: true`. A reference to anything outside the declaration
 * therefore resolves to nothing and degrades to `any` WITHOUT a diagnostic —
 * which is how 0.33.0 shipped `import("@/domain/models/app").FileRef`.
 *
 * Three pieces, split out of `build-types.ts` so the emitter stays one job:
 *   - `inlineModuleReferences` — hoist every module-referenced type into the
 *     declaration and rewrite the reference to a bare name (the fix)
 *   - `findUnresolvedSpecifiers` — the textual guard (also duplicated, by
 * design, in `[internal ref]`)
 *   - `typeCheckDeclaration` — the declaration type-checked on its own with
 *     library checking ON, which catches what a text scan cannot (a bare name
 *     nothing declares, a circular alias)
 */

import { join } from 'node:path'
import ts from 'typescript'

// ---------------------------------------------------------------------------
// Module-reference inlining
// ---------------------------------------------------------------------------

/**
 * WHY THE EMITTER INLINES `import("…").Name` REFERENCES
 * ----------------------------------------------------
 * The printer expands anonymous types structurally, but a type that carries a
 * NAME — a recursive alias (`VisibleWhenCondition`), an alias annotated onto a
 * schema (`FileRef`, `DocumentOutput`), an interface (`PathBranch`) — is printed
 * by reference. When that name is not in scope at `src/index.ts`, the reference
 * is spelled as an import type, with whatever specifier the checker found:
 * `import("./domain/models/app/forms/visible-when").VisibleWhenCondition`, or,
 * through a barrel reached via the `@/` path alias,
 * `import("@/domain/models/app").FileRef`.
 *
 * Neither specifier exists in an author's directory. The declaration ships with
 * `skipLibCheck: true`, so tsc reports nothing: every such property silently
 * becomes `any`, and a misspelled key inside a document action or a file field
 * type-checks clean. So every referenced type is hoisted to a top-level alias in
 * the declaration itself, and the reference is rewritten to its bare name — the
 * declaration then names nothing outside itself.
 */
const MODULE_REFERENCE_PATTERN = /import\("([^"]+)"\)\.([A-Za-z_$][\w$]*)/g

/** One `import("<specifier>").<name>` reference found in printed type text. */
export interface ModuleReference {
  readonly specifier: string
  readonly name: string
}

/** The printed body a reference resolves to, plus the declaration it came from. */
export interface ExpandedReference {
  /**
   * Identity of the DECLARATION — two references spelled with different
   * specifiers (a barrel and the defining file) are the same type when this
   * matches, and a name clash when it does not.
   */
  readonly identity: string
  /** The structural body, printed in type-alias position. */
  readonly body: string
}

export interface InlineResult {
  /** The rewritten type strings, in the order they were given. */
  readonly texts: readonly string[]
  /** One top-level alias per referenced type, sorted by name. */
  readonly declarations: readonly { readonly name: string; readonly body: string }[]
}

/** Every module reference in `text`, in order of appearance. */
export const findModuleReferences = (text: string): readonly ModuleReference[] =>
  [...text.matchAll(MODULE_REFERENCE_PATTERN)].map((match) => ({
    specifier: match[1] ?? '',
    name: match[2] ?? '',
  }))

/**
 * Every unresolvable module specifier left in a declaration: an import type, an
 * `import … from`/`export … from` clause, or any quoted `@/` path alias. A
 * declaration written into an author's directory can name nothing outside
 * itself — the binary installs no package and the author has no `@/` alias —
 * and with `skipLibCheck: true` each of these degrades to `any` without a
 * diagnostic. Empty means self-contained.
 */
export const findUnresolvedSpecifiers = (declaration: string): readonly string[] => [
  ...new Set(
    [
      ...declaration.matchAll(/import\(\s*["'][^"']*["']\s*\)/g),
      ...declaration.matchAll(/^\s*(?:import|export)\b[^\n]*\bfrom\s*["'][^"']*["']/gm),
      ...declaration.matchAll(/["']@\/[^"']*["']/g),
    ].map((match) => match[0].trim())
  ),
]

/** Rewrite every module reference in `text` to its bare name. */
const rewriteModuleReferences = (text: string): string =>
  text.replace(MODULE_REFERENCE_PATTERN, (match, _specifier: string, name: string, at: number) => {
    const following = text[at + match.length]
    if (following === '.' || following === '<') {
      throw new Error(
        `Cannot inline '${match}${following}…': a namespace member or a generic reference ` +
          'has no single top-level alias to stand for it'
      )
    }
    return name
  })

/**
 * Hoist every type `texts` reference by module path into a top-level alias, and
 * rewrite the references to bare names — transitively, since a hoisted body can
 * itself reference further named types (and, for a recursive type, itself).
 *
 * `expand` is the compiler-API half (resolve the specifier, print the type); it
 * is injected so this walk is unit-testable without a program. `reserved` holds
 * the names the declaration already exports: a referenced type sharing one would
 * collide, so it throws rather than shipping two meanings for one name.
 */
export const inlineModuleReferences = (
  texts: readonly string[],
  expand: (reference: ModuleReference) => ExpandedReference,
  reserved: ReadonlySet<string>
): InlineResult => {
  const byName = new Map<string, ExpandedReference>()
  const expandedBySpelling = new Map<string, ExpandedReference>()

  let queue = texts.flatMap(findModuleReferences)
  while (queue.length > 0) {
    const next: ModuleReference[] = []
    for (const reference of queue) {
      const spelling = `${reference.specifier}\u0000${reference.name}`
      const expanded = expandedBySpelling.get(spelling) ?? expand(reference)
      expandedBySpelling.set(spelling, expanded)

      if (reserved.has(reference.name)) {
        throw new Error(
          `Cannot inline '${reference.name}': the declaration already exports a type by that name`
        )
      }
      const known = byName.get(reference.name)
      if (known !== undefined) {
        if (known.identity !== expanded.identity) {
          throw new Error(
            `Cannot inline '${reference.name}': two different types share the name ` +
              `(${known.identity} and ${expanded.identity})`
          )
        }
        continue
      }
      byName.set(reference.name, expanded)
      next.push(...findModuleReferences(expanded.body))
    }
    queue = next
  }

  const declarations = [...byName.entries()]
    .map(([name, { body }]) => ({ name, body: rewriteModuleReferences(body) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const rewritten = texts.map(rewriteModuleReferences)

  const leftover = [...rewritten, ...declarations.map((d) => d.body)].flatMap(findModuleReferences)
  if (leftover.length > 0) {
    throw new Error(`Module references survived inlining: ${leftover[0]?.name ?? ''}`)
  }

  return { texts: rewritten, declarations }
}

// ---------------------------------------------------------------------------
// In-memory files on a compiler host
// ---------------------------------------------------------------------------

/**
 * WHY VIRTUAL FILES ARE MATCHED BY A NORMALISED KEY, NEVER BY `===`
 * ----------------------------------------------------------------
 * The compiler normalises every file name before it asks its host for it:
 * `createProgram` turns a root `D:\a\repo\src\x.ts` into `D:/a/repo/src/x.ts`.
 * A name built with `node:path` keeps the platform's separator, so on Windows
 * the two spellings of one file never compare equal — the host falls through
 * to the disk, finds nothing, and the in-memory file silently does not exist.
 * That is how 0.34.0's Windows build lost the print-scope module. Matching on
 * the slash-normalised name, case-folded where the host's file system is case
 * insensitive (the compiler's own rule), makes the lookup independent of which
 * spelling either side used.
 */
const virtualFileKey = (fileName: string, caseSensitive: boolean): string => {
  const slashed = fileName.replace(/\\/g, '/')
  return caseSensitive ? slashed : slashed.toLowerCase()
}

/** A compiler host that also serves `files` from memory, and the test for one of them. */
export interface VirtualFileHost {
  readonly host: ts.CompilerHost
  /** Whether `fileName`, in any spelling the compiler uses, is one of the in-memory files. */
  readonly isVirtual: (fileName: string) => boolean
}

/**
 * Serve `files` (file name → text) from memory through `host`'s `getSourceFile`,
 * `fileExists` and `readFile`; every other name falls through to `host`. The
 * file names may be spelled with either separator (see above).
 */
export const withVirtualFiles = (
  host: ts.CompilerHost,
  files: ReadonlyMap<string, string>
): VirtualFileHost => {
  const caseSensitive = host.useCaseSensitiveFileNames()
  const byKey = new Map(
    [...files].map(([fileName, text]) => [virtualFileKey(fileName, caseSensitive), text] as const)
  )
  const textOf = (fileName: string): string | undefined =>
    byKey.get(virtualFileKey(fileName, caseSensitive))
  const getSourceFile = host.getSourceFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const readFile = host.readFile.bind(host)
  return {
    host: {
      ...host,
      getSourceFile: (fileName, languageVersion, ...rest) => {
        const text = textOf(fileName)
        return text === undefined
          ? getSourceFile(fileName, languageVersion, ...rest)
          : ts.createSourceFile(fileName, text, languageVersion, true)
      },
      fileExists: (fileName) => textOf(fileName) !== undefined || fileExists(fileName),
      readFile: (fileName) => textOf(fileName) ?? readFile(fileName),
    },
    isVirtual: (fileName) => textOf(fileName) !== undefined,
  }
}

/**
 * Type-check the declaration in isolation, as an author's project would see it:
 * wrapped in `declare module 'sovrium'`, imported from a one-line config, and
 * with `skipLibCheck` OFF so the declaration itself is checked. Returns the
 * flattened diagnostic messages; empty means it stands alone.
 */
export const typeCheckDeclaration = (dtsContent: string, scratchDir: string): readonly string[] => {
  const root = join(scratchDir, 'self-check')
  const declarationFile = join(root, 'sovrium.d.ts')
  const configFile = join(root, 'app.ts')
  const virtualFiles = new Map<string, string>([
    [declarationFile, `declare module 'sovrium' {\n${dtsContent}\n}\n`],
    [
      configFile,
      "import type { AppConfig, CodeContext } from 'sovrium'\n" +
        'export type Probe = readonly [AppConfig, CodeContext]\n',
    ],
  ])
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    moduleDetection: ts.ModuleDetectionKind.Force,
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    noUncheckedIndexedAccess: true,
    types: [],
  }
  const { host, isVirtual } = withVirtualFiles(ts.createCompilerHost(options), virtualFiles)

  const program = ts.createProgram([declarationFile, configFile], options, host)
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file === undefined || isVirtual(d.file.fileName))
    .map((d) => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, ' ')
      return `TS${d.code}: ${message.length > 300 ? `${message.slice(0, 300)}…` : message}`
    })
}
