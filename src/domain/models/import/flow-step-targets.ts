/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape of a row of an automation registry, and the two constructors every
 * registry writes its targets with.
 *
 * The registries themselves live in `flow-step-mappings.ts` and, for a source
 * whose rows outgrow it, in a file of their own (`zapier-step-mappings.ts`);
 * both build their rows from here, so a row file never imports the module that
 * gathers it.
 */

import type { FieldsSource } from './flow-set-fields-mappings'
import type { Action } from '@/domain/models/app/automations/actions/action-union'
import type { Trigger } from '@/domain/models/app/automations/trigger/trigger'

/** A Sovrium action, by its `type` and an `operator` that type really has. */
export type ActionTarget = {
  readonly [T in OperatorAction['type']]: {
    readonly type: T
    readonly operator: Extract<OperatorAction, { readonly type: T }>['operator']
  }
}[OperatorAction['type']]

/** The actions addressed by `type` and `operator` (a `ref` to a template is not one). */
type OperatorAction = Extract<Action, { readonly operator: string }>

/** Where a source step lands. */
export type StepTarget =
  | { readonly kind: 'action'; readonly action: ActionTarget }
  | { readonly kind: 'connection'; readonly connection: string; readonly operation: string }
  | { readonly kind: 'none'; readonly reason: string }
  | { readonly kind: 'todo'; readonly reason: string }

/** One row of a step registry. */
export interface StepMapping {
  /** The step type, in the tool's own spelling (an n8n node type, a Make module). */
  readonly source: string
  /** The operation within the step, when the step type alone does not decide. */
  readonly operation?: string
  readonly target: StepTarget
  /** What the mapping loses; printed as `degraded`. */
  readonly loss?: string
  /** Why the step is imported as a TODO even though it maps; the automation lands disabled. */
  readonly todo?: string
  /**
   * For an action target, where each Sovrium prop is read from: prop → the
   * step input holding it. A prop whose input is absent makes the step a TODO,
   * unless its input name ends in `?`. A row with no `params` maps an action
   * whose inputs cannot be carried over, so the step is a TODO naming it.
   */
  readonly params?: Readonly<Record<string, string>>
  /** For a `data/set` target, where the step's NAMED values are read from, in place of `params`. */
  readonly fields?: FieldsSource
}

/** One row of a trigger registry. */
export interface TriggerMapping {
  readonly source: string
  readonly operation?: string
  readonly target: Trigger['type']
  readonly loss?: string
  /**
   * Why the automation is a TODO even though its trigger maps (a source event
   * the target only stands in for); a `webhook`, `manual` or polling `cron` target only.
   */
  readonly todo?: string
  /**
   * For a `webhook` target standing in for an app event: the connection
   * operation that points the vendor at the webhook. The adapter then reads the
   * trigger as an `app-event`, so the connection is installed with that
   * operation declared, on the trigger's own source credential. For a `form`
   * target, the same operation registers the webhook the trigger falls back
   * to when the form is not imported with the flow.
   */
  readonly connection?: { readonly connection: string; readonly operation: string }
  /**
   * For a `cron` target standing in for an app event the vendor cannot push:
   * the connection operation that lists the items, where the list sits in its
   * answer, and the field that identifies an item. The automation then polls:
   * the list call first, a `state/filterNew` keyed on `key` when the items
   * carry one, and the source's steps run once per new item.
   */
  readonly poll?: PollSource
}

/**
 * Whether a trigger row keeps its source event as an app event: a webhook it
 * registers, or a poll. A form row's operation rides on the form trigger instead.
 */
export const standsForAppEvent = (row: TriggerMapping | undefined): boolean =>
  (row?.target === 'webhook' && row.connection !== undefined) ||
  (row?.target === 'cron' && row.poll !== undefined)

/** How a polled app event is read: the list call and the item identity. */
export interface PollSource {
  readonly connection: string
  readonly operation: string
  /** The path of the item list inside the answer; absent, the answer is the list. */
  readonly items?: string
  /** The field identifying an item; absent, the items carry none and the TODO says so. */
  readonly key?: string
}

export const CODE_TODO =
  'The original code is kept as a comment of a TypeScript stub; it is never translated'

/**
 * An action target, checked at the call site: `operator` must be one the
 * `type` really has. The cast only rebuilds the pair TypeScript cannot
 * correlate on its own; the parameters have already been checked.
 */
export const action = <T extends ActionTarget['type']>(
  type: T,
  operator: Extract<ActionTarget, { readonly type: T }>['operator']
): StepTarget => ({ kind: 'action', action: { type, operator } as ActionTarget })

/**
 * A step with no Sovrium equivalent that is still KEPT: it becomes a stub
 * carrying `reason` as its TODO, unlike a `none` row, whose step is dropped.
 */
export const byHand = (reason: string): StepTarget => ({ kind: 'todo', reason })

export const call = (connection: string, operation: string): StepTarget => ({
  kind: 'connection',
  connection,
  operation,
})

/** Where a row sends a step, in the words a report uses. */
export const targetWords = (row: StepMapping | undefined): string | undefined => {
  if (row?.target.kind === 'action')
    return `${row.target.action.type}/${row.target.action.operator}`
  return row?.target.kind === 'connection'
    ? `the ${row.target.connection} connection's ${row.target.operation}`
    : undefined
}
