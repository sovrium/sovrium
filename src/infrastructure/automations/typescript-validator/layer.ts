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

const isExecuteFunctionDeclaration = (node: ts.Node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name !== undefined && node.name.text === 'execute'

const validateExecuteSignature = (entry: CodeActionEntry): TSValidationError | undefined => {
  const sourceFile = ts.createSourceFile(
    `__signature-check__-${entry.automationId}-${String(entry.actionIndex)}.ts`,
    entry.code,
    ts.ScriptTarget.ES2020,
    true
  )
  const executeFn = sourceFile.statements.find(isExecuteFunctionDeclaration)
  if (executeFn === undefined) return undefined
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
  const annotationText = annotation.getText(sourceFile).trim()
  if (annotationText !== 'CodeContext') {
    return new TSValidationError({
      ...baseError,
      message: `runTypescript code action must annotate execute()'s first parameter as \`CodeContext\` exactly. Found: \`${annotationText}\`. The runTypescript operator validates against the project's CodeContext shape (trigger, steps, env, actions, log, inputData, packages); aliases or refinements are not supported.`,
    })
  }
  return undefined
}

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

export const TypeScriptValidatorLive = Layer.succeed(
  TypeScriptValidator,
  TypeScriptValidator.of({
    validateAll: (app) =>
      Effect.gen(function* () {
        const entries = collectCodeActions(app)
        if (entries.length === 0) return
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
