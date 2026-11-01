/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The in-memory compiler host the startup code-action validator runs `tsc`
 * against: the deferred compiler load, the embedded `lib.*.d.ts` corpus, the
 * pinned compiler options and the virtual-file host.
 *
 * Split out of `layer.ts`, which keeps the prelude and the Layer.
 */

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { embeddedFilePaths } from '@/infrastructure/assets/embedded-file-path'
import { TS_LIB_FILES as RAW_TS_LIB_FILES } from './embedded-ts-lib-types.generated'
import type { CodeActionEntry } from './collect-code-actions'
import type ts from 'typescript'

/** The compiler (~9 MB), required by the first validation that has code to check. */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred load, see above
export const compiler = (): typeof ts => require('typescript') as typeof ts

/**
 * Map of `lib.*.d.ts` basename → embedded path.
 *
 * Source mode: each value is a real `node_modules/typescript/lib/<file>` path.
 * Compiled binary: each value is a `/$bunfs/...` path (Bun's virtual FS).
 *
 * The generated map is `@ts-nocheck` (file imports are typed as content, not
 * paths); `embeddedFilePaths` checks that every value is a path.
 */
const TS_LIB_FILES = embeddedFilePaths(RAW_TS_LIB_FILES)

/**
 * The embedded contents of every `lib.*.d.ts` (~3.9 MB), read once, on first
 * use, with `readFileSync` (synchronous like tsc's `CompilerHost`; handles both
 * real paths and Bun's `/$bunfs/`). Like the compiler itself (see
 * `compiler`), nothing is read at start or for an app without code actions.
 */
let TS_LIB_CONTENTS_CACHE: Map<string, string> | undefined

const getTsLibContents = (): ReadonlyMap<string, string> => {
  TS_LIB_CONTENTS_CACHE ??= new Map(
    Object.entries(TS_LIB_FILES).map(([name, path]) => [name, readFileSync(path, 'utf-8')])
  )
  return TS_LIB_CONTENTS_CACHE
}

/** One synthetic `.ts` file: the prelude plus one code action's body. */
export interface VirtualFile {
  readonly path: string
  readonly content: string
  readonly entry: CodeActionEntry
}

// `ts.CompilerOptions` is a third-party mutable type that the CompilerHost
// API requires by reference. Treating it as Readonly here would force casts
// at every call site without real safety improvement.
export const compilerOptions = (): ts.CompilerOptions => ({
  target: compiler().ScriptTarget.ES2020,
  // Pinned DELIBERATELY. Without an explicit `lib`, `target: ES2020` makes
  // tsc load `lib.es2020.full.d.ts`, which chains in `lib.dom.d.ts` — so
  // every DOM global (`document`, `window`, `fetch`, `localStorage`,
  // `alert`, `caches`, …) became nameable inside a code action. None of
  // them is bound by `vm.createContext`, so each type-checked at boot and
  // threw `ReferenceError` at request time, in production, with no gate in
  // between. Pinning to the non-`full` ES2020 lib removes that entire class
  // at the source: the ambient surface is now ES2020 plus exactly what
  // `CODE_CONTEXT_PRELUDE` spells out, and every future addition has to be
  // written down. `Sandbox Globals Drift` holds the two in agreement.
  //
  // The corpus embeds every `lib.*.d.ts` TypeScript ships, so the file this
  // names is always resolvable in both source and binary mode.
  lib: ['lib.es2020.d.ts'],
  module: compiler().ModuleKind.ESNext,
  moduleResolution: compiler().ModuleResolutionKind.Bundler,
  strict: false,
  noEmit: true,
  skipLibCheck: true,
  esModuleInterop: true,
  allowJs: false,
  isolatedModules: false,
  isolatedDeclarations: false,
})

/**
 * Look up `lib.*.d.ts` content by basename. Returns `undefined` for any
 * non-lib request so the caller can fall through to the real-host path.
 *
 * The lookup is by basename only: tsc requests lib files using a resolved
 * absolute path (e.g. `/node_modules/typescript/lib/lib.es2020.d.ts` in dev,
 * `/$bunfs/.../lib.es2020.d.ts` in the binary). Both surfaces produce the
 * same basename, so a one-shot `basename()` match keeps the lookup uniform
 * across deployment modes.
 */
const lookupTsLibContent = (fileName: string): string | undefined => {
  const base = basename(fileName)
  if (!base.startsWith('lib.') || !base.endsWith('.d.ts')) return undefined
  return getTsLibContents().get(base)
}

/**
 * Build a CompilerHost backed by the in-memory virtual files. Serves the
 * TypeScript standard library (`lib.*.d.ts`) from the embedded corpus so
 * type-checking works identically in source mode (where the real host
 * would read from `node_modules/typescript/lib/`) and in the compiled
 * binary (where no `node_modules/` exists on disk).
 *
 * Returns a mutable `ts.CompilerHost` because `ts.createProgram`
 * mutates the host (caches source files, etc.). Wrapping in `Readonly`
 * would require casts on every call site without changing the
 * underlying behavior.
 */
export const buildVirtualHost = (files: ReadonlyArray<VirtualFile>): ts.CompilerHost => {
  const fileMap: ReadonlyMap<string, string> = new Map(files.map((f) => [f.path, f.content]))
  const realHost = compiler().createCompilerHost(compilerOptions(), true)
  return {
    ...realHost,
    getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      const virtual = fileMap.get(fileName)
      if (virtual !== undefined) {
        return compiler().createSourceFile(fileName, virtual, languageVersion, true)
      }
      const libContent = lookupTsLibContent(fileName)
      if (libContent !== undefined) {
        return compiler().createSourceFile(fileName, libContent, languageVersion, true)
      }
      return realHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
    },
    fileExists: (fileName) =>
      fileMap.has(fileName) ||
      lookupTsLibContent(fileName) !== undefined ||
      realHost.fileExists(fileName),
    readFile: (fileName) =>
      fileMap.get(fileName) ?? lookupTsLibContent(fileName) ?? realHost.readFile(fileName),
    writeFile: () => undefined,
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
  }
}
