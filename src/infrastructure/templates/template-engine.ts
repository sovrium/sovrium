/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/immutable-data, functional/no-expression-statements --
   Handlebars's `engine.compile` returns the same closure every call, so the
   compile cache (`Map<string, Compiled>`) is a write-once-per-template
   optimisation. Using a Map (instead of a frozen record) keeps the lookup
   O(1) and matches the established mutable-Handlebars-instance pattern in
   `handlebars-helpers.ts`. The mutations are confined to this file. */

import Handlebars from 'handlebars'
import { logError } from '@/infrastructure/logging/logger'
import { registerHelpers } from './handlebars-helpers'

/**
 * Internal: a Handlebars instance with the Sovrium helper catalogue
 * pre-registered. Created once at module load — registration is idempotent
 * but doing it on first import keeps render-time work to compile + execute.
 *
 * We use `Handlebars.create()` to obtain a private instance instead of
 * mutating the default global one. That way, host applications that embed
 * Sovrium and ship their own Handlebars instance for unrelated purposes
 * (e.g. email layouts) cannot collide with our helpers.
 */
const engine = Handlebars.create()
registerHelpers(engine)

/**
 * Pattern that matches strings containing at least one Handlebars expression
 * (`{{...}}`). Used as a fast-path: literal strings without templates skip
 * the compile step entirely, which keeps the legacy `{{trigger.data.X}}`
 * substitution cost identical to the pre-engine implementation.
 *
 * The inner match is `[\s\S]*?` (lazy, dot-all) — NOT `[^}]*`. A `[^}]*`
 * inner class wrongly bails out on expressions that legitimately contain a
 * `}` between the staches, e.g. `{{regex x "INV-\d{4}-(\d+)"}}` (the `}` of
 * the `{4}` quantifier). Bailing meant `renderTemplate` returned the
 * literal `{{regex …}}` string unrendered. The lazy `[\s\S]*?` stops at the
 * first real `}}`, which is the closing stache.
 */
const TEMPLATE_PATTERN = /\{\{[\s\S]*?\}\}/

/**
 * Compile cache for templates that have been seen before. Hot paths
 * (record-trigger filter LHS resolution against many candidate records,
 * per-record action prop substitution) re-render the same template string
 * thousands of times in a single dispatch — caching the compile output cuts
 * per-render cost from ~20us to ~1us in microbenchmarks.
 *
 * The cache is unbounded by design: automation templates come from app
 * config (a finite, small set authored by the operator), not from request
 * bodies, so unbounded growth is not a concern. The sentinel `FAILED_COMPILE`
 * marks a template that previously failed to parse, so we don't re-pay the
 * (expensive) parse-error cost on every render.
 */
type Compiled = (ctx: Readonly<Record<string, unknown>>) => string
const FAILED_COMPILE: Compiled = () => ''
const compileCache = new Map<string, Compiled>()

/**
 * The slice of a Handlebars AST node the pattern check reads. Mustache, block
 * and subexpression nodes carry a `path` and `params`; blocks add `program`
 * and `inverse`; every call may carry a `hash`.
 */
interface TemplateNode {
  readonly type: string
  readonly original?: unknown
  readonly path?: TemplateNode
  readonly params?: ReadonlyArray<TemplateNode>
  readonly hash?: { readonly pairs: ReadonlyArray<{ readonly value: TemplateNode }> }
  readonly program?: { readonly body: ReadonlyArray<TemplateNode> }
  readonly inverse?: { readonly body: ReadonlyArray<TemplateNode> }
}

/** The helpers that compile their second argument as a regular expression. */
const PATTERN_HELPERS: ReadonlySet<string> = new Set(['regex', 'matchAll'])

/**
 * Whether this node calls `regex` / `matchAll` with a pattern that is not a
 * quoted string written in the template: a path (a trigger field, a step
 * output, a variable), a subexpression, or no pattern at all. Such a pattern
 * reaches the helper from data, and a nested quantifier in it would backtrack
 * on the server's only thread.
 */
const takesPatternFromData = (node: TemplateNode): boolean =>
  node.path?.type === 'PathExpression' &&
  PATTERN_HELPERS.has(String(node.path.original)) &&
  node.params?.[1]?.type !== 'StringLiteral'

const childrenOf = (node: TemplateNode): ReadonlyArray<TemplateNode> => [
  ...(node.path === undefined ? [] : [node.path]),
  ...(node.params ?? []),
  ...(node.hash?.pairs.map((pair) => pair.value) ?? []),
  ...(node.program?.body ?? []),
  ...(node.inverse?.body ?? []),
]

const hasPatternFromData = (node: TemplateNode): boolean =>
  takesPatternFromData(node) || childrenOf(node).some(hasPatternFromData)

/**
 * Parse, refuse a data-supplied regex pattern, then compile the parsed AST.
 * Parsing eagerly (`engine.compile` alone defers it to the first call) also
 * makes a syntax error a compile failure rather than a render failure.
 */
const compileAuthored = (template: string): Compiled => {
  const ast = engine.parse(template)
  if ((ast.body as ReadonlyArray<TemplateNode>).some(hasPatternFromData)) {
    if (process.env['DEBUG']?.includes('sovrium:templates')) {
      logError(
        '[templates] compile refused',
        new Error('regex/matchAll pattern must be a quoted string in the template'),
        { template }
      )
    }
    return FAILED_COMPILE
  }
  return engine.compile(ast, { noEscape: true, strict: false })
}

const getCompiled = (template: string): Compiled => {
  const cached = compileCache.get(template)
  if (cached !== undefined) return cached
  const result = ((): Compiled => {
    try {
      return compileAuthored(template)
    } catch (error) {
      if (process.env['DEBUG']?.includes('sovrium:templates')) {
        logError('[templates] compile failed', error, { template })
      }
      return FAILED_COMPILE
    }
  })()
  compileCache.set(template, result)
  return result
}

/**
 * The helpers every Handlebars environment is born with (`each`, `if`, `log`,
 * `lookup`, `with`, `helperMissing`, ...). They are block or meta helpers, not
 * values: a bare `{{each}}` renders its own literal text and a bare `{{log}}`
 * writes to the console. Read off a fresh environment rather than listed, so a
 * Handlebars upgrade that adds one is excluded without an edit here.
 */
const BUILT_IN_HELPERS: ReadonlySet<string> = new Set(Object.keys(Handlebars.create().helpers))

/**
 * Whether `name` is a helper Sovrium registers (`now`, `today`, `uppercase`,
 * ...). A caller that looks a whole-string `{{name}}` up as a PATH uses it to
 * tell a helper call from a missing key. A Handlebars built-in is not one, even
 * where Sovrium re-registers it (`if`): none of them is a value on its own, so
 * a missing key of that name must stay missing.
 */
export const isTemplateHelper = (name: string): boolean =>
  Object.hasOwn(engine.helpers, name) && !BUILT_IN_HELPERS.has(name)

/**
 * Render a Handlebars template against the provided context. Returns the
 * rendered string. Compile errors and runtime helper errors are caught and
 * the original input is returned unchanged — this matches the legacy
 * resolver's "missing path -> empty string" non-throwing semantics, so a
 * malformed template in user-authored automation config cannot crash the
 * automation engine.
 */
export const renderTemplate = (
  template: string,
  context: Readonly<Record<string, unknown>>
): string => {
  if (!TEMPLATE_PATTERN.test(template)) return template
  const compiled = getCompiled(template)
  if (compiled === FAILED_COMPILE) return template
  try {
    return compiled(context)
  } catch (error) {
    // Runtime helper failure: surface the original string rather than
    // crashing the action. This branch is rare given our helpers are
    // intentionally total — but defensive against custom helpers added
    // later that may throw.
    if (process.env['DEBUG']?.includes('sovrium:templates')) {
      logError('[templates] render failed', error, { template })
    }
    return template
  }
}
