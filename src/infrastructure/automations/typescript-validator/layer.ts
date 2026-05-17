/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import ts from 'typescript'
import { TSValidationError } from './errors'
import { TypeScriptValidator } from './service'

/**
 * Inline `CodeContext` interface prepended to every synthetic `.ts`
 * file as an ambient declaration. Mirrors the shape exported from
 * `@sovrium/types` so the in-process compiler doesn't need to resolve
 * an external module — declaration-emit + module-resolution would slow
 * startup unnecessarily.
 *
 * IMPORTANT: keep this in sync with `packages/types/src/index.ts` —
 * both must describe the same shape so the operator's IDE
 * (`@sovrium/types`-resolved) matches the server-startup validator.
 */
// CodeContext exposes 5 properties to user code: `inputData`, `actions`,
// `env`, `log`, `packages`. Trigger payloads and prior step outputs are
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
// `any` (not `unknown`) is intentional for `inputData`, `packages`, and
// `actions` return: these hold dynamic JSON / module / action-output
// shapes; `unknown` would force narrowing on every property access.
// `log` stays strict so `context.log.debug()` (or any unknown method)
// fails at startup — see TS-004.
//
// Note: the `any` below is in a string literal compiled by tsc against
// user code, NOT a TypeScript expression in our source — ESLint's
// no-explicit-any rule does not apply to template-literal contents.
const CODE_CONTEXT_PRELUDE = `export {};
interface CodeContext {
  readonly inputData: Record<string, any>;
  readonly input?: Record<string, any>;
  readonly actions: {
    readonly ref: (templateName: string, vars?: Record<string, unknown>) => Promise<any>;
  } & Record<string, Record<string, (props?: Record<string, unknown>) => Promise<any>>>;
  readonly env: Record<string, string>;
  readonly log: {
    readonly info: (...args: ReadonlyArray<unknown>) => void;
    readonly warn: (...args: ReadonlyArray<unknown>) => void;
    readonly error: (...args: ReadonlyArray<unknown>) => void;
  };
  readonly packages: Record<string, any>;
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
`

/**
 * Number of source lines added by `CODE_CONTEXT_PRELUDE`. Used to
 * subtract the prelude offset from raw tsc line numbers so reported
 * locations match the user-authored code.
 */
const PRELUDE_LINE_COUNT = CODE_CONTEXT_PRELUDE.split('\n').length - 1

interface CodeActionEntry {
  readonly automationId: string
  readonly actionIndex: number
  readonly code: string
}

interface VirtualFile {
  readonly path: string
  readonly content: string
  readonly entry: CodeActionEntry
}

/**
 * Walk the validated app config collecting every `runTypescript` (or
 * legacy `run`-on-`code`) action body alongside its automation id +
 * positional index. Index is 1-based for human-friendly error messages
 * (`action #1`, not `action #0`).
 */
const collectCodeActions = (root: unknown): ReadonlyArray<CodeActionEntry> => {
  const automations = (root as { readonly automations?: ReadonlyArray<unknown> } | undefined)
    ?.automations
  if (!Array.isArray(automations)) return []
  return automations.flatMap((automation, automationOffset) => {
    if (typeof automation !== 'object' || automation === undefined || automation === null) {
      return []
    }
    const auto = automation as Record<string, unknown>
    const { name } = auto as { readonly name?: unknown }
    const automationId = typeof name === 'string' ? name : `automation-${String(automationOffset)}`
    const { actions } = auto as { readonly actions?: unknown }
    if (!Array.isArray(actions)) return []
    return actions.flatMap((action, actionIndex): ReadonlyArray<CodeActionEntry> => {
      if (typeof action !== 'object' || action === undefined || action === null) return []
      const a = action as Record<string, unknown>
      if (a['type'] !== 'code') return []
      const { props } = a as { readonly props?: unknown }
      if (typeof props !== 'object' || props === undefined || props === null) return []
      const { code } = props as { readonly code?: unknown }
      if (typeof code !== 'string' || code === '') return []
      return [{ automationId, actionIndex: actionIndex + 1, code }]
    })
  })
}

const buildVirtualFile = (entry: CodeActionEntry): VirtualFile => ({
  path: `automation-${entry.automationId}-action-${String(entry.actionIndex)}.ts`,
  content: `${CODE_CONTEXT_PRELUDE}${entry.code}`,
  entry,
})

/**
 * Pre-`tsc` AST check: enforce that every `code` action's `execute`
 * function annotates its first parameter as `CodeContext`. Without this
 * gate, an untyped `(context)` would compile against `any` and the whole
 * point of the `runTypescript` operator (typed `context` access checked
 * at startup) would be lost. Zero-parameter `execute()` is allowed —
 * that form genuinely needs no context.
 *
 * The check parses the user's source ONLY (no prelude prepended) so the
 * error's line/column point at the operator's authored body, not at the
 * synthetic prelude. Failures surface BEFORE `tsc` runs, giving a
 * domain-specific error message instead of a raw type-checker diagnostic.
 */
// Predicate hoisted to module scope so the find() call below stays a
// pure functional traversal — no `let` mutation, no visitor side-effect.
const isExecuteFunctionDeclaration = (node: ts.Node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name !== undefined && node.name.text === 'execute'

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
  const lineAndChar = sourceFile.getLineAndCharacterOfPosition(firstParam.getStart(sourceFile))
  const baseError = {
    automationId: entry.automationId,
    actionIndex: entry.actionIndex,
    file: '<code-action-body>',
    line: lineAndChar.line + 1,
    column: lineAndChar.character + 1,
  }
  if (annotation === undefined) {
    return new TSValidationError({
      ...baseError,
      message:
        "runTypescript code action must annotate execute()'s first parameter as `CodeContext`. Example: `async function execute(context: CodeContext) { ... }`. The annotation is required so type errors on `context.<key>` accesses surface at server startup instead of failing silently at request time.",
    })
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
      message: `runTypescript code action must annotate execute()'s first parameter as \`CodeContext\` exactly. Found: \`${annotationText}\`. The runTypescript operator validates against the project's CodeContext shape (trigger, steps, env, actions, log, inputData, packages); aliases or refinements are not supported.`,
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
 * Build a CompilerHost backed by the in-memory virtual files. Falls
 * back to the real filesystem for the standard libs (`lib.d.ts` etc.)
 * since we want full type-checking against the standard library.
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
      return realHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
    },
    fileExists: (fileName) => fileMap.has(fileName) || realHost.fileExists(fileName),
    readFile: (fileName) => fileMap.get(fileName) ?? realHost.readFile(fileName),
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
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
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
        // Pre-tsc gate: enforce the `execute(context: CodeContext)` annotation
        // contract. Failures here surface a domain-specific error pointing at
        // the user's body — far more actionable than a tsc diagnostic that
        // would otherwise complain about `context.foo` being `any`.
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
