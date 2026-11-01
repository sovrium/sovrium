/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AiActionSchema } from './ai'
import { AnalyticsActionSchema } from './analytics'
import { AppActionSchema } from './app'
import { ApprovalActionSchema } from './approval'
import { AuthActionSchema } from './auth'
import { AutomationActionSchema } from './automation'
import { BrowserActionSchema } from './browser'
import { CalendarActionSchema } from './calendar'
import { CodeActionSchema } from './code'
import { CommentActionSchema } from './comment'
import { ConnectionActionSchema } from './connection'
import { CryptoActionSchema } from './crypto'
import { DataActionSchema } from './data'
import { DateActionSchema } from './date'
import { DelayActionSchema } from './delay'
import { DigestActionSchema } from './digest'
import { DocumentActionSchema } from './document'
import { EmailActionSchema } from './email'
import { FileActionSchema } from './file'
import { FilterActionSchema } from './filter'
import { FlowActionSchema } from './flow'
import { HttpActionSchema } from './http'
import { InstanceActionSchema } from './instance'
import { LinkActionSchema } from './link'
import { LoopActionSchema } from './loop'
import { NotificationActionSchema } from './notification'
import { PathActionSchema } from './path'
import { PdfActionSchema } from './pdf'
import { RecordActionSchema } from './record'
import { ActionRefSchema } from './ref'
import { SovriumActionSchema } from './sovrium'
import { StateActionSchema } from './state'
import { WebhookActionSchema } from './webhook'
import type { ConditionGroup } from '../conditions'
import type { RetryConfig } from '../retry'

// ─── Action Type ────────────────────────────────────────────────────────────
//
// Every non-recursive family is DERIVED from its schema, so the type a
// `defineConfig` author writes against cannot drift from what the engine
// decodes. Only the two families that contain actions (`path/branch` and
// `loop/each`) are written by hand: their schemas reference `Action` through
// `Schema.suspend`, so deriving them would make the alias circular.

/** The fields every action shares, restated for the hand-written recursive arms. */
export interface ActionBase {
  readonly name: string
  readonly label?: string
  readonly retry?: RetryConfig
  readonly continueOnError?: boolean
  /**
   * Per-action timeout (ms). When the action's execution exceeds this
   * duration the run loop cancels it and the step records as failure.
   * Distinct from per-action-type `props.timeout` (e.g. `code.props.timeout`,
   * `http.props.timeout`) which fence the handler's internal Promise-race.
   * This top-level field is enforced uniformly for ALL action types.
   */
  readonly timeout?: number
}

export interface PathBranch {
  readonly name: string
  readonly condition?: ConditionGroup
  readonly actions: readonly Action[]
}

type Props<T> = { readonly props: T }

/** The recursive arms, hand-written (see above). */
type RecursiveAction =
  // ── path (recursive) ──
  | (ActionBase & {
      readonly type: 'path'
      readonly operator: 'branch'
    } & Props<{
        readonly paths: readonly PathBranch[]
        readonly mode?: 'first-match' | 'all-matching'
      }>)
  // ── loop (recursive) ──
  | (ActionBase & {
      readonly type: 'loop'
      readonly operator: 'each'
    } & Props<{
        readonly items: string
        readonly actions: readonly Action[]
        readonly maxIterations?: number
        readonly continueOnItemError?: boolean
      }>)

/**
 * Action type — the union of every action variant. One line per family of
 * the `ActionSchema` union below, in the same order.
 */
export type Action =
  | Schema.Schema.Type<typeof CodeActionSchema>
  | Schema.Schema.Type<typeof HttpActionSchema>
  | Schema.Schema.Type<typeof RecordActionSchema>
  | Schema.Schema.Type<typeof FilterActionSchema>
  | RecursiveAction
  | Schema.Schema.Type<typeof EmailActionSchema>
  | Schema.Schema.Type<typeof AuthActionSchema>
  | Schema.Schema.Type<typeof AnalyticsActionSchema>
  | Schema.Schema.Type<typeof LinkActionSchema>
  | Schema.Schema.Type<typeof CommentActionSchema>
  | Schema.Schema.Type<typeof NotificationActionSchema>
  | Schema.Schema.Type<typeof WebhookActionSchema>
  | Schema.Schema.Type<typeof DelayActionSchema>
  | Schema.Schema.Type<typeof AutomationActionSchema>
  | Schema.Schema.Type<typeof ConnectionActionSchema>
  | Schema.Schema.Type<typeof AiActionSchema>
  | Schema.Schema.Type<typeof ApprovalActionSchema>
  | Schema.Schema.Type<typeof BrowserActionSchema>
  | Schema.Schema.Type<typeof FileActionSchema>
  | Schema.Schema.Type<typeof DocumentActionSchema>
  | Schema.Schema.Type<typeof PdfActionSchema>
  | Schema.Schema.Type<typeof DataActionSchema>
  | Schema.Schema.Type<typeof StateActionSchema>
  | Schema.Schema.Type<typeof DigestActionSchema>
  | Schema.Schema.Type<typeof CryptoActionSchema>
  | Schema.Schema.Type<typeof CalendarActionSchema>
  | Schema.Schema.Type<typeof DateActionSchema>
  | Schema.Schema.Type<typeof FlowActionSchema>
  | Schema.Schema.Type<typeof SovriumActionSchema>
  | Schema.Schema.Type<typeof AppActionSchema>
  | Schema.Schema.Type<typeof InstanceActionSchema>
  | Schema.Schema.Type<typeof ActionRefSchema>

// ─── Action Schema Union ────────────────────────────────────────────────────

/**
 * Union of all action types.
 * Each type folder exports a union of its operators.
 * The top-level union composes all type unions.
 */
export const ActionSchema: Schema.Codec<Action, unknown> = Schema.Union([
  CodeActionSchema,
  HttpActionSchema,
  RecordActionSchema,
  FilterActionSchema,
  PathActionSchema,
  LoopActionSchema,
  EmailActionSchema,
  AuthActionSchema,
  AnalyticsActionSchema,
  LinkActionSchema,
  CommentActionSchema,
  NotificationActionSchema,
  WebhookActionSchema,
  DelayActionSchema,
  AutomationActionSchema,
  ConnectionActionSchema,
  AiActionSchema,
  ApprovalActionSchema,
  BrowserActionSchema,
  FileActionSchema,
  DocumentActionSchema,
  PdfActionSchema,
  DataActionSchema,
  StateActionSchema,
  DigestActionSchema,
  CryptoActionSchema,
  CalendarActionSchema,
  DateActionSchema,
  FlowActionSchema,
  SovriumActionSchema,
  AppActionSchema,
  InstanceActionSchema,
  ActionRefSchema,
]).pipe(
  Schema.annotate({
    // MUST stay distinct from the component-action union's `Action` identifier
    // (`src/domain/models/app/pages/components/action.ts`). Effect keys JSON
    // Schema `$defs` by `identifier`, so two schemas sharing one identifier
    // collapse into a single `$def`: one union is published and the other is
    // erased. That is what happened here — every automation action
    // (`file/upload`, `http/request`, `email/send`, …) was missing from
    // the public schema at https://sovrium.com/schema/app.json that config
    // authors are told to validate against. Guarded by the identifier
    // collision + action-coverage tests in
    // `src/domain/models/app/app-json-schema.test.ts`.
    identifier: 'AutomationAction',
    title: 'Automation Action',
    description:
      'An individual step in an automation workflow. Structure: type + operator + props.',
  })
) as Schema.Codec<Action, unknown>
