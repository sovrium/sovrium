/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import CODE_CONTEXT_PRELUDE from './code-context-prelude.d.ts.txt' with { type: 'text' }
import { collectCodeActions } from './collect-code-actions'
import { TSValidationError } from './errors'
import { synthesizeContextAnnotation, validateExecuteSignature } from './execute-signature'
import { TypeScriptValidator } from './service'
import { buildVirtualHost, compiler, compilerOptions } from './virtual-compiler-host'
import type { CodeActionEntry } from './collect-code-actions'
import type { VirtualFile } from './virtual-compiler-host'
import type ts from 'typescript'

/**
 * Inline `CodeContext` interface prepended to every synthetic `.ts`
 * file as an ambient declaration. Mirrors the shape `sovrium.d.ts` ships
 * so the in-process compiler doesn't need to resolve an external module —
 * declaration-emit + module-resolution would slow startup unnecessarily.
 *
 * IMPORTANT: keep the `CodeContext` interface in
 * `code-context-prelude.d.ts.txt` (beside this file) in sync with
 * `src/domain/models/config-types/code-context.ts` — `CodeContext Mirror
 * Parity` fails the build when the operator's IDE and this gate disagree.
 *
 * The sync contract covers `CodeContext` ONLY. The `Buffer` declaration
 * that follows it is deliberately OUTSIDE that contract: `Buffer` is not
 * a member of `CodeContext`, it is a sandbox global (see the globals
 * allowlist in `src/application/use-cases/automations/action-handlers/code.ts`)
 * that the operator's IDE already resolves from `@types/node`. Adding it
 * to `sovrium.d.ts` would ship a competing `Buffer` declaration into
 * every consumer's project and collide with the real Node types. So:
 * `Buffer` lives BESIDE the sync contract, not inside it — do not
 * "resync" it into `src/domain/models/config-types/code-context.ts`.
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
// Note: the `any` in the prelude asset is text compiled by tsc against
// user code, NOT a TypeScript expression in our source — ESLint's
// no-explicit-any rule never sees the `.txt` file.
//
// ── Sandbox globals ───────────────────────────────────────────────────
// The prelude declares every sandbox global the ES standard library does
// NOT: `Buffer`, `console`, `URL`, `URLSearchParams`, `setTimeout`,
// `clearTimeout` and `crypto`.
//
// The list has to be complete because `lib` is pinned. With `lib` unset, a
// bare `target: ES2020` makes tsc load `lib.es2020.full.d.ts` — which pulls
// in `lib.dom.d.ts`. A code action does not run in a DOM, so that default
// would silently declare the ENTIRE DOM surface (`document`, `window`,
// `fetch`, `localStorage`, `alert`, …) to operator code that cannot reach
// any of it. Each of those names would type-check cleanly at boot and throw
// `ReferenceError` at request time — the "declared but ungranted" failure
// mode, unbounded. `lib` is therefore pinned to `lib.es2020.d.ts` (see
// `compilerOptions`) so the ambient surface is exactly ES2020 plus what this
// prelude spells out.
//
// The consequence is that adding a global is always a deliberate act:
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
// DELIBERATELY LOOSER THAN THE SHIPPED DECLARATION, and the direction matters.
//
// `sovrium.d.ts` now closes `actions` into named families with per-operator props
// (`CodeContextActions` in src/domain/models/config-types/code-context.ts, expanded by
// build-types.ts). This prelude keeps the open index signature, so this gate accepts
// everything the closed type accepts and more. That asymmetry is SAFE in this
// direction: the author's editor is strict, so a mistake surfaces where they are
// looking, and this gate never rejects code their editor called valid. The dangerous
// direction — a gate stricter than the editor, so code passes authoring and dies at
// boot — is the one this arrangement avoids.
//
// It is also not free: because this is open, `context.actions.record.lst({})`
// still passes STARTUP validation and fails at request time. Closing it here
// would move that catch to boot, and needs the expanded text available at
// runtime (this is a string fed to tsc, not a type). That is the natural
// follow-up; it is out of scope for the change that closed the author-facing
// surface.
//
// Note also that this gate runs `strict: false` (see `compilerOptions`) while the
// emitted tsconfig runs `strict: true` + `noUncheckedIndexedAccess: true`. Those
// two configurations have never matched, and closing `actions` is what stopped
// that mismatch from producing the TS18048/TS2722 pair on the documented call.

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

/**
 * The synthetic file tsc checks for one code action: the prelude, then the
 * author's body with `: CodeContext` spliced onto `execute`'s first parameter
 * when it was left unannotated (see `synthesizeContextAnnotation`).
 */
const buildVirtualFile = (entry: CodeActionEntry): VirtualFile => ({
  path: `automation-${entry.automationId}-action-${String(entry.actionIndex)}.ts`,
  content: `${CODE_CONTEXT_PRELUDE}${synthesizeContextAnnotation(entry.code)}`,
  entry,
})

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
    message: explainUnresolvedName(
      compiler().flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    ),
  })
}

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
        const program = compiler().createProgram(
          files.map((f) => f.path),
          compilerOptions(),
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
