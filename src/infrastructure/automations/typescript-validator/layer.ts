/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { Effect, Layer } from 'effect'
import ts from 'typescript'
import { collectCodeActions } from './collect-code-actions'
import { TS_LIB_FILES as RAW_TS_LIB_FILES } from './embedded-ts-lib-types.generated'
import { TSValidationError } from './errors'
import { TypeScriptValidator } from './service'
import type { CodeActionEntry } from './collect-code-actions'

/**
 * Map of `lib.*.d.ts` basename → embedded path.
 *
 * Source mode: each value is a real `node_modules/typescript/lib/<file>` path.
 * Compiled binary: each value is a `/$bunfs/...` path (Bun's virtual FS).
 *
 * `with { type: 'file' }` imports are typed as the imported module's shape,
 * not as strings, so the generated map is `@ts-nocheck` and we cast through
 * `unknown` to recover the runtime type.
 */
const TS_LIB_FILES = RAW_TS_LIB_FILES as unknown as Readonly<Record<string, string>>

/**
 * Read the embedded contents of every `lib.*.d.ts` into a Map at module
 * init. tsc's `CompilerHost.getSourceFile`/`fileExists`/`readFile` are
 * synchronous so the contents must be available without an async hop.
 *
 * Reads happen ONCE per process (this module is loaded once). Total payload
 * is ~3.9 MB across ~107 files — negligible at startup.
 *
 * The read uses `readFileSync` which transparently handles both real
 * filesystem paths (dev) and Bun's `/$bunfs/` virtual paths (compiled binary).
 *
 * Marked as a let-initialized lazy `Map` rather than evaluated eagerly so
 * tests that don't touch the validator never pay the read cost.
 */
// eslint-disable-next-line functional/no-let, functional/prefer-immutable-types -- module-scope lazy memoization cache; Map is mutated once on first read
let TS_LIB_CONTENTS_CACHE: Map<string, string> | undefined

const getTsLibContents = (): ReadonlyMap<string, string> => {
  // eslint-disable-next-line functional/no-expression-statements -- memoization cache write
  TS_LIB_CONTENTS_CACHE ??= new Map(
    Object.entries(TS_LIB_FILES).map(([name, path]) => [name, readFileSync(path, 'utf-8')])
  )
  return TS_LIB_CONTENTS_CACHE
}

/**
 * Inline `CodeContext` interface prepended to every synthetic `.ts`
 * file as an ambient declaration. Mirrors the shape exported from
 * `@sovrium/types` so the in-process compiler doesn't need to resolve
 * an external module — declaration-emit + module-resolution would slow
 * startup unnecessarily.
 *
 * IMPORTANT: keep the `CodeContext` interface below in sync with
 * `packages/types/src/index.ts` — both must describe the same shape so
 * the operator's IDE (`@sovrium/types`-resolved) matches the
 * server-startup validator.
 *
 * The sync contract covers `CodeContext` ONLY. The `Buffer` declaration
 * that follows it is deliberately OUTSIDE that contract: `Buffer` is not
 * a member of `CodeContext`, it is a sandbox global (see the globals
 * allowlist in `src/application/use-cases/automations/action-handlers/code.ts`)
 * that the operator's IDE already resolves from `@types/node`. Adding it
 * to `@sovrium/types` would ship a competing `Buffer` declaration into
 * every consumer's project and collide with the real Node types. So:
 * `Buffer` lives BESIDE the sync contract, not inside it — do not
 * "resync" it into `packages/types/src/index.ts`.
 */
// CodeContext exposes 5 properties to user code: `inputData`, `actions`,
// `env`, `log`, `run`. Trigger payloads and prior step outputs are
// NOT directly reachable from the sandbox — every value the code needs
// must be declared explicitly via the action's `inputData` prop using
// `{{trigger.data.X}}` / `{{steps.Y.Z}}` template references, resolved
// before the sandbox sees the data. This makes a code action a pure
// function of its declared inputs.
//
// `actions` references reusable action templates declared at
// `app.actions[]` (the schema-root registry), NOT sibling steps in the
// same automation. `context.actions.<templateName>(input)` invokes the
// named template, substituting its `$vars` with the caller-supplied
// `input` (shallow-merged on top of declared variable defaults).
//
// `any` (not `unknown`) is intentional for `inputData` and the `actions`
// return: these hold dynamic JSON / action-output shapes; `unknown` would
// force narrowing on every property access. `log` stays strict so
// `context.log.debug()` (or any unknown method) fails at startup — see
// TS-004.
//
// Note: the `any` below is in a string literal compiled by tsc against
// user code, NOT a TypeScript expression in our source — ESLint's
// no-explicit-any rule does not apply to template-literal contents.
//
// ── Sandbox globals ───────────────────────────────────────────────────
// The prelude declares every sandbox global the ES standard library does
// NOT: `Buffer`, `console`, `URL`, `URLSearchParams`, `setTimeout`,
// `clearTimeout` and `crypto`.
//
// That list used to be just `Buffer`, because `COMPILER_OPTIONS` left
// `lib` unset and a bare `target: ES2020` makes tsc load
// `lib.es2020.full.d.ts` — which pulls in `lib.dom.d.ts`. A code action
// does not run in a DOM, so that default silently declared the ENTIRE DOM
// surface (`document`, `window`, `fetch`, `localStorage`, `alert`, …) to
// operator code that cannot reach any of it. Each of those names
// type-checked cleanly at boot and threw `ReferenceError` at request time
// — the "declared but ungranted" failure mode, unbounded. `lib` is now
// pinned to `lib.es2020.d.ts` (see COMPILER_OPTIONS) so the ambient
// surface is exactly ES2020 plus what this prelude spells out.
//
// The consequence is that adding a global is now always a deliberate act:
// anything outside ES2020 must be declared here, and `Sandbox Globals
// Drift` fails the build if a declaration and a grant disagree.
//
// Do NOT declare a name the ES lib already provides (`Map`, `Symbol`,
// `Promise`, `Intl`, …) — duplicating a lib type can conflict with it.
//
// Shapes here are honest SUBSETS, not full host typings (same caveat as
// `Buffer`): a member that exists at runtime but is omitted below fails
// type-check, which is the safe direction. The unsafe direction —
// declaring something the runtime lacks — is what the drift check guards.
//
// The declaration is module-scoped (the prelude opens with `export {};`,
// making each synthetic file a module) rather than a `declare global`
// block. Module scope shadows any ambient global of the same name, so
// this stays inert even if a future host change causes `@types/node` to
// be auto-included.
const CODE_CONTEXT_PRELUDE = `export {};
interface CodeContext {
  readonly inputData: Record<string, any>;
  readonly actions: {
    readonly ref: (templateName: string, vars?: Record<string, unknown>) => Promise<any>;
  } & Record<string, Record<string, (props?: Record<string, unknown>) => Promise<any>>>;
  readonly env: Record<string, string>;
  readonly log: {
    readonly info: (...args: ReadonlyArray<unknown>) => void;
    readonly warn: (...args: ReadonlyArray<unknown>) => void;
    readonly error: (...args: ReadonlyArray<unknown>) => void;
  };
  /**
   * Run-scoped metadata. \`attempt\` is the 1-indexed retry attempt number —
   * 1 on the initial dispatch, 2 on the first retry, etc. Used by code
   * actions that want to short-circuit retry on a recoverable transient
   * (APP-AUTOMATION-RETRY-015): \`if (context.run.attempt === 1) throw …\`.
   */
  readonly run: {
    readonly attempt: number;
  };
}
type BufferEncoding =
  | 'ascii'
  | 'utf8'
  | 'utf-8'
  | 'utf16le'
  | 'utf-16le'
  | 'ucs2'
  | 'ucs-2'
  | 'base64'
  | 'base64url'
  | 'latin1'
  | 'binary'
  | 'hex';
interface Buffer extends Uint8Array {
  toString(encoding?: BufferEncoding, start?: number, end?: number): string;
  toJSON(): { type: 'Buffer'; data: number[] };
  equals(otherBuffer: Uint8Array): boolean;
  write(value: string, encoding?: BufferEncoding): number;
  subarray(start?: number, end?: number): Buffer;
}
interface BufferConstructor {
  from(value: string, encoding?: BufferEncoding): Buffer;
  from(value: ArrayBuffer | ArrayBufferView | ReadonlyArray<number>): Buffer;
  alloc(size: number, fill?: string | number, encoding?: BufferEncoding): Buffer;
  concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
  byteLength(value: string, encoding?: BufferEncoding): number;
  isBuffer(value: unknown): boolean;
}
declare const Buffer: BufferConstructor;
interface Console {
  log(...data: any[]): void;
  info(...data: any[]): void;
  warn(...data: any[]): void;
  error(...data: any[]): void;
  debug(...data: any[]): void;
  trace(...data: any[]): void;
  dir(item?: any): void;
  table(data: any): void;
  group(...data: any[]): void;
  groupEnd(): void;
  time(label?: string): void;
  timeEnd(label?: string): void;
  count(label?: string): void;
  assert(condition?: boolean, ...data: any[]): void;
}
declare const console: Console;
interface URLSearchParams {
  readonly size: number;
  append(name: string, value: string): void;
  delete(name: string, value?: string): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string, value?: string): boolean;
  set(name: string, value: string): void;
  sort(): void;
  toString(): string;
  forEach(callback: (value: string, key: string, parent: URLSearchParams) => void): void;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  entries(): IterableIterator<[string, string]>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}
interface URLSearchParamsConstructor {
  new (init?: string | string[][] | Record<string, string> | URLSearchParams): URLSearchParams;
}
declare const URLSearchParams: URLSearchParamsConstructor;
interface URL {
  hash: string;
  host: string;
  hostname: string;
  href: string;
  readonly origin: string;
  password: string;
  pathname: string;
  port: string;
  protocol: string;
  search: string;
  readonly searchParams: URLSearchParams;
  username: string;
  toString(): string;
  toJSON(): string;
}
interface URLConstructor {
  new (url: string | URL, base?: string | URL): URL;
  canParse(url: string | URL, base?: string): boolean;
}
declare const URL: URLConstructor;
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any;
declare function clearTimeout(handle?: any): void;
interface Crypto {
  randomUUID(): string;
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  readonly subtle: SubtleCrypto;
}
interface SubtleCrypto {
  digest(algorithm: any, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
  encrypt(algorithm: any, key: any, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
  decrypt(algorithm: any, key: any, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
  sign(algorithm: any, key: any, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
  verify(algorithm: any, key: any, signature: ArrayBuffer | ArrayBufferView, data: ArrayBuffer | ArrayBufferView): Promise<boolean>;
  importKey(format: string, keyData: any, algorithm: any, extractable: boolean, keyUsages: string[]): Promise<any>;
  exportKey(format: string, key: any): Promise<any>;
  generateKey(algorithm: any, extractable: boolean, keyUsages: string[]): Promise<any>;
  deriveBits(algorithm: any, baseKey: any, length: number): Promise<ArrayBuffer>;
  deriveKey(algorithm: any, baseKey: any, derivedKeyType: any, extractable: boolean, keyUsages: string[]): Promise<any>;
}
declare const crypto: Crypto;
`

/**
 * The globals the runtime sandbox actually binds, quoted back to the
 * operator when a code action names something that does not resolve.
 *
 * This is a MESSAGE list, not a source of truth: the authoritative
 * allowlist is the `sandbox` object literal in
 * `src/application/use-cases/automations/action-handlers/code.ts`, which
 * the infrastructure layer must not import. `Sandbox Globals Drift`
 * (`[internal ref]`, run by `bun run quality`)
 * fails if this list stops matching that literal — a hint that
 * misreports the available surface is worse than no hint at all.
 */
const SANDBOX_GLOBAL_NAMES: ReadonlyArray<string> = [
  'console',
  'JSON',
  'Math',
  'Date',
  'Promise',
  'Number',
  'String',
  'Boolean',
  'Array',
  'Object',
  'Error',
  'RegExp',
  'Map',
  'Set',
  'Symbol',
  'Buffer',
  'URL',
  'URLSearchParams',
  'setTimeout',
  'clearTimeout',
  'crypto',
  'Intl',
]

/**
 * Matches tsc's unresolved-identifier family: TS2304 (`Cannot find name
 * 'x'.`) and its "do you need to install type definitions" variants
 * (TS2580/2583/2584/2591), which append advice that is actively
 * misleading here.
 *
 * The advice is wrong because this compiler runs IN-PROCESS at server
 * startup, not in the operator's editor — no `npm i --save-dev
 * @types/node` they run can change the outcome. That dead end is what
 * made the `Buffer` boot failure expensive to diagnose, so we replace
 * the tail of the message with the one thing that IS actionable: what
 * the sandbox actually provides.
 */
const UNRESOLVED_NAME_PATTERN = /^Cannot find name '([A-Za-z_$][\w$]*)'\./

/**
 * Rewrite an unresolved-identifier diagnostic into sandbox terms. Every
 * other diagnostic passes through untouched.
 */
const explainUnresolvedName = (message: string): string => {
  const match = UNRESOLVED_NAME_PATTERN.exec(message)
  if (match === null) return message
  const name = match[1] ?? ''
  if (SANDBOX_GLOBAL_NAMES.includes(name)) {
    // Should be unreachable: `Sandbox Globals Drift` fails the quality
    // gate when a granted global does not resolve. If it ever fires it
    // is a Sovrium bug, and saying so beats sending the operator after
    // a dependency that cannot help.
    return (
      `Cannot find name '${name}'. '${name}' IS provided by the code-action sandbox but the ` +
      `startup validator cannot resolve it — this is a Sovrium bug, not a problem with your ` +
      `config. Please report it.`
    )
  }
  return (
    `Cannot find name '${name}'. Code actions run in a restricted sandbox that provides only: ` +
    `${SANDBOX_GLOBAL_NAMES.join(', ')}. Node/Bun APIs (fetch, process, require, fs, …) and ` +
    `module imports are deliberately absent — pass any value the code needs through the ` +
    `action's \`inputData\`, and reach other steps via \`context.actions\`. Installing type ` +
    `definitions cannot help: this compiler runs in-process at server startup, not in your editor.`
  )
}

/**
 * Number of source lines added by `CODE_CONTEXT_PRELUDE`. Used to
 * subtract the prelude offset from raw tsc line numbers so reported
 * locations match the user-authored code.
 */
const PRELUDE_LINE_COUNT = CODE_CONTEXT_PRELUDE.split('\n').length - 1

interface VirtualFile {
  readonly path: string
  readonly content: string
  readonly entry: CodeActionEntry
}

// Predicate hoisted to module scope so the find() calls below stay pure
// functional traversals — no `let` mutation, no visitor side-effect. It is
// declared HERE, above its first use, because both the annotation
// synthesis and the signature gate need it.
const isExecuteFunctionDeclaration = (node: ts.Node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name !== undefined && node.name.text === 'execute'

/**
 * Splice `: CodeContext` onto `execute`'s first parameter when the author
 * left it unannotated, so `tsc` type-checks the body against the real
 * `CodeContext` exactly as if the annotation had been written by hand.
 *
 * This synthesis is what keeps the gate STRONG while the signature check
 * below tolerates an unannotated parameter. `COMPILER_OPTIONS` sets
 * `strict: false`, so an unannotated parameter is `any` and every
 * `context.<key>` access would compile silently — merely dropping the
 * annotation requirement would disable type-checking entirely while
 * looking like a fix. Inserting the annotation before tsc sees the body
 * means `context.log.debug` still fails at startup whether or not the
 * author typed `: CodeContext` (specs TS-004 and TS-005 are the pair that
 * hold those two paths to the same standard).
 *
 * Why it must be synthesized rather than required: a `.ts` config is
 * transpiled before it runs, so `String(async function execute(context:
 * CodeContext) { … })` serialises the TRANSPILED function — type
 * annotations are not valid JavaScript, so no transpiler can preserve
 * them. The engine therefore always receives `execute(context)`, and a
 * gate demanding the annotation could not boot the documented pattern
 * (nor the published YAML examples, which are written unannotated too).
 *
 * Two invariants the implementation must keep:
 *
 * - The insertion adds NO newlines. `PRELUDE_LINE_COUNT` is subtracted
 *   from tsc's reported line numbers so errors point at the author's
 *   body; a single-line splice keeps that arithmetic exact.
 * - The insertion point comes from the AST (the parameter name's end
 *   position), never a regex over the source — a regex cannot tell a
 *   parameter list from a matching string inside the body.
 *
 * Zero-parameter `execute()` and a body with no `execute` at all are
 * returned untouched (tsc emits its own error for the latter).
 */
const synthesizeContextAnnotation = (code: string): string => {
  const sourceFile = ts.createSourceFile(
    '__annotation-synthesis__.ts',
    code,
    ts.ScriptTarget.ES2020,
    true
  )
  const executeFn = sourceFile.statements.find(isExecuteFunctionDeclaration)
  if (executeFn === undefined) return code
  const firstParam = executeFn.parameters[0]
  if (firstParam === undefined) return code
  // Already annotated. `validateExecuteSignature` has already rejected
  // anything that is not exactly `CodeContext`, so this is a no-op path.
  if (firstParam.type !== undefined) return code
  // TypeScript's parameter grammar is `name?: Type = default`, so the
  // annotation goes after the optional-token when present, otherwise
  // straight after the binding name (which may be a destructuring
  // pattern — `{ inputData }: CodeContext` is equally valid).
  const insertAt = (firstParam.questionToken ?? firstParam.name).getEnd()
  return `${code.slice(0, insertAt)}: CodeContext${code.slice(insertAt)}`
}

const buildVirtualFile = (entry: CodeActionEntry): VirtualFile => ({
  path: `automation-${entry.automationId}-action-${String(entry.actionIndex)}.ts`,
  content: `${CODE_CONTEXT_PRELUDE}${synthesizeContextAnnotation(entry.code)}`,
  entry,
})

/**
 * Pre-`tsc` AST check: enforce that when a `code` action's `execute`
 * function DOES annotate its first parameter, the annotation is exactly
 * `CodeContext`. An alias or refinement is rejected, because the
 * validator type-checks against the prelude's declaration by name and
 * the operator's contract is that `context` IS a `CodeContext`.
 *
 * An ABSENT annotation is not an error — `buildVirtualFile` synthesizes
 * it (see `synthesizeContextAnnotation`), which is what preserves
 * type-checking strength for the unannotated form. Zero-parameter
 * `execute()` is likewise allowed: that form genuinely needs no context.
 *
 * The check parses the user's source ONLY (no prelude prepended) so the
 * error's line/column point at the operator's authored body, not at the
 * synthetic prelude. Failures surface BEFORE `tsc` runs, giving a
 * domain-specific error message instead of a raw type-checker diagnostic.
 */
/* eslint-disable functional/prefer-immutable-types -- TSValidationError is upstream-mutable */
const validateExecuteSignature = (entry: CodeActionEntry): TSValidationError | undefined => {
  const sourceFile = ts.createSourceFile(
    `__signature-check__-${entry.automationId}-${String(entry.actionIndex)}.ts`,
    entry.code,
    ts.ScriptTarget.ES2020,
    true
  )
  const executeFn = sourceFile.statements.find(isExecuteFunctionDeclaration)
  // No execute function — let tsc emit its own "execute must be defined"
  // error so the validator never duplicates work the type-checker does.
  if (executeFn === undefined) return undefined
  // Zero-parameter `execute()` is intentionally allowed (no context use).
  if (executeFn.parameters.length === 0) return undefined
  const firstParam = executeFn.parameters[0]
  if (firstParam === undefined) return undefined
  const annotation = firstParam.type
  // An ABSENT annotation is accepted: a `.ts` config is transpiled before it
  // runs, so `String(async function execute(context: CodeContext) { … })`
  // can only ever yield `execute(context)` — type annotations are not valid
  // JavaScript, so no transpiler can preserve them. Requiring the annotation
  // here rejected the documented authoring pattern outright, along with the
  // published YAML examples, which are written unannotated too.
  //
  // This does NOT weaken the gate: `buildVirtualFile` splices the annotation
  // in before tsc sees the body (see `synthesizeContextAnnotation`), so
  // `context.<key>` accesses are checked against the real `CodeContext`
  // either way. Spec TS-005 is the one that tells this implementation apart
  // from one that simply deleted the check.
  if (annotation === undefined) return undefined
  const lineAndChar = sourceFile.getLineAndCharacterOfPosition(firstParam.getStart(sourceFile))
  const baseError = {
    automationId: entry.automationId,
    actionIndex: entry.actionIndex,
    file: '<code-action-body>',
    line: lineAndChar.line + 1,
    column: lineAndChar.character + 1,
  }
  // Accept exactly `: CodeContext`. Aliases or unions are out of scope —
  // the operator's contract is that `context` IS a `CodeContext`, not a
  // superset/subset. `tsc` itself catches structural compatibility at the
  // call site once the annotation is in place; we just enforce the
  // annotation's identifier here.
  const annotationText = annotation.getText(sourceFile).trim()
  if (annotationText !== 'CodeContext') {
    return new TSValidationError({
      ...baseError,
      message: `runTypescript code action must annotate execute()'s first parameter as \`CodeContext\` exactly. Found: \`${annotationText}\`. The runTypescript operator validates against the project's CodeContext shape (inputData, actions, env, log, run); aliases or refinements are not supported.`,
    })
  }
  return undefined
}
/* eslint-enable functional/prefer-immutable-types */

// `ts.CompilerOptions` is a third-party mutable type that the CompilerHost
// API requires by reference. Treating it as Readonly here would force casts
// at every call site without real safety improvement.
// eslint-disable-next-line functional/prefer-immutable-types -- ts API requires mutable CompilerOptions
const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
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
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: false,
  noEmit: true,
  skipLibCheck: true,
  esModuleInterop: true,
  allowJs: false,
  isolatedModules: false,
  isolatedDeclarations: false,
}

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
// eslint-disable-next-line functional/prefer-immutable-types -- ts API requires mutable CompilerHost
const buildVirtualHost = (files: ReadonlyArray<VirtualFile>): ts.CompilerHost => {
  const fileMap: ReadonlyMap<string, string> = new Map(files.map((f) => [f.path, f.content]))
  const realHost = ts.createCompilerHost(COMPILER_OPTIONS, true)
  return {
    ...realHost,
    getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      const virtual = fileMap.get(fileName)
      if (virtual !== undefined) {
        return ts.createSourceFile(fileName, virtual, languageVersion, true)
      }
      const libContent = lookupTsLibContent(fileName)
      if (libContent !== undefined) {
        return ts.createSourceFile(fileName, libContent, languageVersion, true)
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

/**
 * Convert a single tsc diagnostic to a domain `TSValidationError` if
 * the diagnostic points at a virtual file we built. Returns `undefined`
 * for diagnostics anchored elsewhere (lib types, etc.) or without a
 * source location.
 *
 * `ts.Diagnostic` is an upstream-mutable type — wrapping it in
 * `Readonly` would require casts at every call site without changing
 * runtime behavior.
 */
/* eslint-disable functional/prefer-immutable-types -- ts.Diagnostic / TSValidationError are upstream-mutable */
const diagnosticToError = (
  diagnostic: ts.Diagnostic,
  files: ReadonlyArray<VirtualFile>
): TSValidationError | undefined => {
  const sourceFile = diagnostic.file
  if (sourceFile === undefined || diagnostic.start === undefined) return undefined
  const match = files.find((f) => f.path === sourceFile.fileName)
  if (match === undefined) return undefined
  const lineAndChar = sourceFile.getLineAndCharacterOfPosition(diagnostic.start)
  const adjustedLine = lineAndChar.line + 1 - PRELUDE_LINE_COUNT
  return new TSValidationError({
    automationId: match.entry.automationId,
    actionIndex: match.entry.actionIndex,
    file: match.path,
    line: adjustedLine > 0 ? adjustedLine : lineAndChar.line + 1,
    column: lineAndChar.character + 1,
    message: explainUnresolvedName(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
  })
}
/* eslint-enable functional/prefer-immutable-types */

/**
 * Live TypeScriptValidator implementation. Runs `ts.createProgram`
 * once per `validateAll` call across all collected code action bodies.
 * Skip-check the standard lib (`skipLibCheck: true`) because we only
 * care about the user's body — lib type errors would be on TypeScript
 * itself, not the operator's config.
 */
export const TypeScriptValidatorLive = Layer.succeed(
  TypeScriptValidator,
  TypeScriptValidator.of({
    validateAll: (app) =>
      Effect.gen(function* () {
        const entries = collectCodeActions(app)
        if (entries.length === 0) return
        // Pre-tsc gate: reject an `execute` first-parameter annotation that is
        // present but is not exactly `CodeContext`. Failures here surface a
        // domain-specific error pointing at the user's body — far more
        // actionable than the tsc diagnostic an alias would otherwise produce.
        // An unannotated parameter passes this gate and is annotated by
        // `buildVirtualFile` below, so tsc still checks it against the real
        // `CodeContext`.
        const signatureFailure = entries
          .map(validateExecuteSignature)
          .find((e): e is TSValidationError => e !== undefined)
        if (signatureFailure !== undefined) {
          return yield* signatureFailure
        }
        const files = entries.map(buildVirtualFile)
        const host = buildVirtualHost(files)
        const program = ts.createProgram(
          files.map((f) => f.path),
          COMPILER_OPTIONS,
          host
        )
        const diagnostics = [
          ...program.getSyntacticDiagnostics(),
          ...program.getSemanticDiagnostics(),
        ]
        const firstFailure = diagnostics
          .map((d) => diagnosticToError(d, files))
          .find((e): e is TSValidationError => e !== undefined)
        if (firstFailure !== undefined) {
          return yield* firstFailure
        }
      }),
  })
)
