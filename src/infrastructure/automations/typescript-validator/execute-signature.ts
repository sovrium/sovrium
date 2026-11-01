/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two AST passes the startup code-action validator makes over an
 * author's body before `tsc` sees it: the `execute` signature gate and the
 * `: CodeContext` annotation synthesis.
 *
 * Split out of `layer.ts`, which keeps the prelude and the Layer.
 */

import { TSValidationError } from './errors'
import { compiler } from './virtual-compiler-host'
import type { CodeActionEntry } from './collect-code-actions'
import type ts from 'typescript'

// Predicate hoisted to module scope so the find() calls below stay pure
// functional traversals — no `let` mutation, no visitor side-effect. It is
// declared HERE, above its first use, because both the annotation
// synthesis and the signature gate need it.
const isExecuteFunctionDeclaration = (node: ts.Node): node is ts.FunctionDeclaration =>
  compiler().isFunctionDeclaration(node) && node.name !== undefined && node.name.text === 'execute'

/**
 * Splice `: CodeContext` onto `execute`'s first parameter when the author
 * left it unannotated, so `tsc` type-checks the body against the real
 * `CodeContext` exactly as if the annotation had been written by hand.
 *
 * This synthesis is what keeps the gate STRONG while the signature check
 * below tolerates an unannotated parameter. `compilerOptions` sets
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
export const synthesizeContextAnnotation = (code: string): string => {
  const sourceFile = compiler().createSourceFile(
    '__annotation-synthesis__.ts',
    code,
    compiler().ScriptTarget.ES2020,
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
export const validateExecuteSignature = (entry: CodeActionEntry): TSValidationError | undefined => {
  const sourceFile = compiler().createSourceFile(
    `__signature-check__-${entry.automationId}-${String(entry.actionIndex)}.ts`,
    entry.code,
    compiler().ScriptTarget.ES2020,
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
