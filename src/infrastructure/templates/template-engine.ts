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

const getCompiled = (template: string): Compiled => {
  const cached = compileCache.get(template)
  if (cached !== undefined) return cached
  const result = ((): Compiled => {
    try {
      return engine.compile(template, { noEscape: true, strict: false })
    } catch (error) {
      if (process.env['DEBUG']?.includes('sovrium:templates')) {
        console.error('[templates] compile failed', { template, error })
      }
      return FAILED_COMPILE
    }
  })()
  compileCache.set(template, result)
  return result
}

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
      console.error('[templates] render failed', { template, error })
    }
    return template
  }
}
