/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An automation AS IT IS WRITTEN: `AutomationConfig`, the authored step union
 * it holds, and `ActionTemplate`, the reusable step an automation names with
 * `$ref`. Part of the public `sovrium` type surface, re-exported by
 * `src/index.ts`.
 */

import type { AppConfigEntry } from './app-config'
import type { AppEncoded } from '@/domain/models/app'
import type { Action as AutomationActionUnion } from '@/domain/models/app/automations/actions'

/** The step a `$ref` names an action template with; its `type` defaults to `'ref'`. */
type AuthoredRefStep = Omit<Extract<AutomationActionUnion, { readonly type: 'ref' }>, 'type'> & {
  readonly type?: 'ref'
}

/** Nested steps, written the way top-level ones are. */
type AuthoredSteps = { readonly actions: readonly AuthoredAutomationAction[] }

/** A `loop` step, whose nested steps are authored steps. */
type LoopStep = Extract<AutomationActionUnion, { readonly type: 'loop' }>
type AuthoredLoopStep = Omit<LoopStep, 'props'> & {
  readonly props: Omit<LoopStep['props'], 'actions'> & AuthoredSteps
}

/** A `path` step, whose branches hold authored steps. */
type PathStep = Extract<AutomationActionUnion, { readonly type: 'path' }>
type AuthoredPathStep = Omit<PathStep, 'props'> & {
  readonly props: Omit<PathStep['props'], 'paths'> & {
    readonly paths: readonly (Omit<PathStep['props']['paths'][number], 'actions'> & AuthoredSteps)[]
  }
}

/**
 * One automation step as it is written: the step union, with a `$ref` step's
 * `type` optional because it defaults to `'ref'` — at the top level and inside
 * the two steps that nest others, `loop` and `path`.
 *
 * The step schema's ENCODED side is `unknown` (the union is far too large for
 * TypeScript to serialise, so its codec is declared `Codec<Action, unknown>`),
 * which would leave every step untyped here. So the steps are described by the
 * hand-written step union instead, relaxed by the one default it does not
 * express. Exported so the declaration can name it, recursive as it is.
 */
export type AuthoredAutomationAction =
  | Exclude<AutomationActionUnion, { readonly type: 'ref' | 'loop' | 'path' }>
  | AuthoredRefStep
  | AuthoredLoopStep
  | AuthoredPathStep

/**
 * Single automation configuration (element of `AppConfig['automations']`).
 * Declares either `trigger` (one) or `triggers` (1 to 10); `sovrium validate`
 * refuses an automation that declares both.
 */
export type AutomationConfig = Omit<NonNullable<AppEncoded['automations']>[number], 'actions'> & {
  readonly actions: readonly AuthoredAutomationAction[]
}

/**
 * Reusable action template (element of `AppConfig['actions']`).
 *
 * Deliberately NOT named `ActionConfig`, which the `*Config` convention above would
 * suggest: `ActionTemplate` is already the public name every config author writes,
 * and one public name per concept beats naming symmetry.
 */
export type ActionTemplate = AppConfigEntry<'actions'>
