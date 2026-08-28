/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AiActionSchema } from './ai'
import { AnalyticsActionSchema } from './analytics'
import { ApprovalActionSchema } from './approval'
import { AuthActionSchema } from './auth'
import { AutomationActionSchema } from './automation'
import { CodeActionSchema } from './code'
import { CryptoActionSchema } from './crypto'
import { DataActionSchema } from './data'
import { DateActionSchema } from './date'
import { DelayActionSchema } from './delay'
import { DigestActionSchema } from './digest'
import { EmailActionSchema } from './email'
import { FileActionSchema } from './file'
import { FilterActionSchema } from './filter'
import { FlowActionSchema } from './flow'
import { HttpActionSchema } from './http'
import { LoopActionSchema } from './loop'
import { PathActionSchema } from './path'
import { RecordActionSchema } from './record'
import { ActionRefSchema } from './ref'
import { SovriumActionSchema } from './sovrium'
import { StateActionSchema } from './state'
import { WebhookActionSchema } from './webhook'
import type { ConditionGroup } from '../conditions'
import type { RetryConfig } from '../retry'

// ─── Action Type (manually defined for recursive types) ─────────────────────

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

/** Column definition shared by the `generateXlsx` single- and multi-sheet forms. */
type XlsxColumnDef = {
  readonly key?: string
  readonly field?: string
  readonly header?: string
}

/**
 * Action type — manually defined union of all action variants.
 * Each type+operator pair is a separate variant with specific props.
 */
export type Action =
  // ── code ──
  | (ActionBase & {
      readonly type: 'code'
      readonly operator: 'runTypescript'
    } & Props<{
        readonly code: string
        readonly inputData?: { readonly [key: string]: unknown }
        readonly timeout?: number
      }>)
  // ── http ──
  | (ActionBase & {
      readonly type: 'http'
      readonly operator: 'request'
    } & Props<{
        readonly url: string
        // Literal HTTP method or a template string resolved at runtime.
        readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | string
        readonly headers?: { readonly [key: string]: string }
        readonly body?: string | { readonly [key: string]: unknown }
        readonly contentType?: 'json' | 'form' | 'text' | 'xml'
        readonly timeout?: number
      }>)
  | (ActionBase & {
      readonly type: 'http'
      readonly operator: 'get'
    } & Props<{
        readonly url: string
        readonly headers?: { readonly [key: string]: string }
        readonly timeout?: number
        readonly connection?: string
      }>)
  | (ActionBase & {
      readonly type: 'http'
      readonly operator: 'post' | 'put' | 'patch'
    } & Props<{
        readonly url: string
        readonly headers?: { readonly [key: string]: string }
        readonly body?: string | { readonly [key: string]: unknown }
        readonly contentType?: 'json' | 'form' | 'text' | 'xml'
        readonly timeout?: number
        readonly connection?: string
      }>)
  | (ActionBase & {
      readonly type: 'http'
      readonly operator: 'delete'
    } & Props<{
        readonly url: string
        readonly headers?: { readonly [key: string]: string }
        readonly body?: string | { readonly [key: string]: unknown }
        readonly timeout?: number
        readonly connection?: string
      }>)
  // ── record (5 single-record operator variants) ──
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'create'
    } & Props<{
        readonly table: string
        readonly data: { readonly [key: string]: unknown }
        readonly runAs?: 'system' | 'triggering-user'
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'read'
    } & Props<{
        readonly table: string
        readonly filter: ConditionGroup
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'update'
    } & Props<{
        readonly table: string
        readonly data: { readonly [key: string]: unknown }
        readonly filter: ConditionGroup
        readonly runAs?: 'system' | 'triggering-user'
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'delete'
    } & Props<{
        readonly table: string
        readonly filter: ConditionGroup
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'upsert'
    } & Props<{
        readonly table: string
        readonly data: { readonly [key: string]: unknown }
        // `id` and `filter` are mutually exclusive — enforced by the
        // cross-validation layer, not by this type (a union of the two
        // shapes would make the common `{ table, data }` prefix awkward
        // to write and would not model the "exactly one" rule any better).
        readonly id?: string
        readonly filter?: ConditionGroup
        readonly runAs?: 'system' | 'triggering-user'
      }>)
  // ── filter ──
  | (ActionBase & {
      readonly type: 'filter'
      readonly operator: 'continue'
    } & Props<{
        readonly condition: ConditionGroup
        readonly onFalse?: 'stop' | 'skip'
      }>)
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
  // ── email ──
  | (ActionBase & {
      readonly type: 'email'
      readonly operator: 'send'
    } & Props<{
        readonly to: string
        readonly subject: string
        readonly body: string
        readonly from?: string
        // Single recipient or array — handler normalises to array.
        readonly cc?: string | readonly string[]
        readonly bcc?: string | readonly string[]
        readonly replyTo?: string | readonly string[]
      }>)
  // ── auth (4 operator variants) ──
  | (ActionBase & {
      readonly type: 'auth'
      readonly operator: 'createUser'
    } & Props<{
        readonly email: string
        readonly name: string
        readonly password?: string
        readonly role?: string
      }>)
  | (ActionBase & {
      readonly type: 'auth'
      readonly operator: 'assignRole'
    } & Props<{
        readonly userId: string
        readonly role: string
      }>)
  | (ActionBase & {
      readonly type: 'auth'
      readonly operator: 'banUser'
    } & Props<{
        readonly userId: string
        readonly reason?: string
      }>)
  | (ActionBase & {
      readonly type: 'auth'
      readonly operator: 'unbanUser'
    } & Props<{
        readonly userId: string
      }>)
  // ── analytics ──
  | (ActionBase & {
      readonly type: 'analytics'
      readonly operator: 'track'
    } & Props<{
        readonly event: string
        readonly properties?: { readonly [key: string]: unknown }
      }>)
  // ── webhook (2 operator variants) ──
  | (ActionBase & {
      readonly type: 'webhook'
      readonly operator: 'send'
    } & Props<{
        readonly url: string
        readonly event: string
        readonly data?: { readonly [key: string]: unknown }
        readonly secret?: string
      }>)
  | (ActionBase & {
      readonly type: 'webhook'
      readonly operator: 'response'
    } & Props<{
        readonly status?: number
        readonly body?: string | { readonly [key: string]: unknown }
        readonly headers?: { readonly [key: string]: string }
      }>)
  // ── delay ──
  | (ActionBase & {
      readonly type: 'delay'
      readonly operator: 'wait'
    } & Props<{
        readonly duration?: string
        readonly until?: string
      }>)
  | (ActionBase & {
      readonly type: 'delay'
      readonly operator: 'queue'
    } & Props<{
        // Duration string — number + unit (ms, s, m, h), e.g. '2s'.
        readonly interval: string
        readonly maxQueueSize?: number
      }>)
  // ── automation ──
  | (ActionBase & {
      readonly type: 'automation'
      readonly operator: 'call'
    } & Props<{
        readonly name: string
        readonly inputData?: { readonly [key: string]: unknown }
        readonly waitForCompletion?: boolean
        readonly timeout?: number
      }>)
  | (ActionBase & {
      readonly type: 'automation'
      readonly operator: 'return'
    } & Props<{
        readonly data: { readonly [key: string]: unknown }
      }>)
  // ── ai (3 operator variants) ──
  | (ActionBase & {
      readonly type: 'ai'
      readonly operator: 'generate'
    } & Props<{
        // Optional and ADVISORY — see `ai/provider.ts`. Derived from
        // SUPPORTED_AI_PROVIDERS ('custom' is a deprecated back-compat value);
        // the provider actually used comes from the AI_PROVIDER env var.
        readonly provider?:
          'anthropic' | 'openai' | 'mistral' | 'google' | 'ollama' | 'openai-compatible' | 'custom'
        readonly model: string
        readonly prompt: string
        readonly systemPrompt?: string
        readonly connection?: string
        readonly temperature?: number
        readonly maxTokens?: number
        readonly responseFormat?: 'text' | 'json'
        readonly baseUrl?: string
      }>)
  | (ActionBase & {
      readonly type: 'ai'
      readonly operator: 'classify'
    } & Props<{
        // Optional and ADVISORY — see `ai/provider.ts`. Derived from
        // SUPPORTED_AI_PROVIDERS ('custom' is a deprecated back-compat value);
        // the provider actually used comes from the AI_PROVIDER env var.
        readonly provider?:
          'anthropic' | 'openai' | 'mistral' | 'google' | 'ollama' | 'openai-compatible' | 'custom'
        readonly model: string
        readonly input: string
        readonly categories: readonly string[]
        readonly connection?: string
        readonly baseUrl?: string
      }>)
  | (ActionBase & {
      readonly type: 'ai'
      readonly operator: 'extract'
    } & Props<{
        // Optional and ADVISORY — see `ai/provider.ts`. Derived from
        // SUPPORTED_AI_PROVIDERS ('custom' is a deprecated back-compat value);
        // the provider actually used comes from the AI_PROVIDER env var.
        readonly provider?:
          'anthropic' | 'openai' | 'mistral' | 'google' | 'ollama' | 'openai-compatible' | 'custom'
        readonly model: string
        readonly input: string
        readonly schema: { readonly [key: string]: unknown }
        readonly connection?: string
        readonly baseUrl?: string
      }>)
  // ── approval ──
  | (ActionBase & {
      readonly type: 'approval'
      readonly operator: 'request'
    } & Props<{
        readonly approvers?: 'all-admins' | readonly string[]
        readonly message: string
        readonly options?: readonly {
          readonly value: string
          readonly label?: string
        }[]
        readonly timeout?: string
        readonly onTimeout?: 'approve' | 'reject' | 'escalate'
        readonly notifyVia?: 'email' | 'webhook' | 'both'
      }>)
  // ── record batch operators ──
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'batchCreate'
    } & Props<{
        readonly table: string
        readonly items: string
        readonly continueOnItemError?: boolean
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'batchUpdate'
    } & Props<{
        readonly table: string
        readonly items: string
        readonly continueOnItemError?: boolean
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'batchDelete'
    } & Props<{
        readonly table: string
        readonly filter: ConditionGroup
        readonly limit?: number
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'batchUpsert'
    } & Props<{
        readonly table: string
        readonly items: string
        readonly matchField: string
        readonly continueOnItemError?: boolean
      }>)
  // ── file (14 operator variants) ──
  // Phase 1 — Storage Operations
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'upload'
    } & Props<{
        readonly source: string
        readonly path?: string
        readonly contentType?: string
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'download'
    } & Props<{
        readonly key: string
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'delete'
    } & Props<{
        readonly key: string
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'copy'
    } & Props<{
        readonly source: string
        readonly destination: string
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'move'
    } & Props<{
        readonly source: string
        readonly destination: string
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'list'
    } & Props<{
        readonly prefix: string
        readonly limit?: number
      }>)
  // Phase 1 — Metadata & Access
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'getMetadata'
    } & Props<{
        readonly key: string
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'signUrl'
    } & Props<{
        readonly key: string
        readonly expiresIn?: number
        readonly operation?: 'download' | 'upload'
      }>)
  // Phase 1 — Generation (enhanced with destination)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'generatePdf'
    } & Props<{
        readonly template: string
        readonly filename: string
        readonly data?: { readonly [key: string]: unknown }
        readonly pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal'
        readonly orientation?: 'portrait' | 'landscape'
        readonly margins?: {
          readonly top?: string
          readonly right?: string
          readonly bottom?: string
          readonly left?: string
        }
        readonly destination?: string
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'generateCsv'
    } & Props<{
        readonly data: string
        readonly filename: string
        readonly columns?: readonly {
          readonly key: string
          readonly header?: string
        }[]
        readonly delimiter?: ',' | ';' | '\t' | '|'
        readonly includeHeaders?: boolean
        readonly destination?: string
      }>)
  // Phase 2 — Advanced
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'parseCsv'
    } & Props<{
        readonly source: string
        readonly columns?: readonly {
          readonly key: string
          readonly header?: string
        }[]
        readonly skipRows?: number
        readonly delimiter?: ',' | ';' | '\t' | '|'
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'extractText'
    } & Props<{
        readonly source: string
        readonly format?: 'plain' | 'markdown'
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'transformImage'
    } & Props<{
        readonly source: string
        readonly width?: number
        readonly height?: number
        readonly fit?: 'fill' | 'inside'
        readonly format?: 'jpeg' | 'png' | 'webp'
        readonly quality?: number
        readonly destination?: string
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'compress'
    } & Props<{
        readonly files: string
        readonly filename: string
        readonly destination?: string
      }>)
  // Phase 3 — Spreadsheets (closed OOXML subset)
  // `source` and `key` are both optional HERE because they are aliases and the
  // schema's own filter enforces that at least one is present; TypeScript
  // cannot express "exactly one of" without collapsing the arm into a union.
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'parseXlsx'
    } & Props<{
        readonly source?: string
        readonly key?: string
        readonly sheet?: string | number
        readonly header?: boolean
        readonly range?: string
        readonly skipRows?: number
      }>)
  | (ActionBase & {
      readonly type: 'file'
      readonly operator: 'generateXlsx'
    } & Props<{
        readonly data?: string
        readonly sheets?: readonly {
          readonly name: string
          readonly data: string
          readonly columns?: readonly XlsxColumnDef[]
        }[]
        readonly columns?: readonly XlsxColumnDef[]
        readonly sheetName?: string
        readonly filename: string
        readonly destination?: string
      }>)
  // ── data (9 operator variants) ──
  | (ActionBase & {
      readonly type: 'data'
      readonly operator: 'set'
    } & Props<{
        readonly value: string
      }>)
  | (ActionBase & {
      readonly type: 'data'
      readonly operator: 'aggregate'
    } & Props<{
        readonly input: string
        readonly function: 'sum' | 'avg' | 'min' | 'max' | 'count'
        readonly field?: string
        readonly groupBy?: string
      }>)
  | (ActionBase & {
      readonly type: 'data'
      readonly operator: 'sort'
    } & Props<{
        readonly input: string
        readonly field: string
        readonly direction?: 'asc' | 'desc'
      }>)
  | (ActionBase & {
      readonly type: 'data'
      readonly operator: 'limit'
    } & Props<{
        readonly input: string
        readonly count: number
      }>)
  | (ActionBase & {
      readonly type: 'data'
      readonly operator: 'deduplicate'
    } & Props<{
        readonly input: string
        readonly key: string
      }>)
  | (ActionBase & {
      readonly type: 'data'
      readonly operator: 'merge'
    } & Props<{
        readonly left: string
        readonly right: string
        readonly joinKey?: string
      }>)
  | (ActionBase & {
      readonly type: 'data'
      readonly operator: 'split'
    } & Props<{
        readonly input: string
        readonly size: number
      }>)
  | (ActionBase & {
      readonly type: 'data'
      readonly operator: 'compare'
    } & Props<{
        readonly left: string
        readonly right: string
        readonly key: string
      }>)
  | (ActionBase & {
      readonly type: 'data'
      readonly operator: 'lookup'
    } & Props<{
        readonly input: string
        readonly key: string
        readonly value: string
      }>)
  // ── state (5 operator variants) ──
  | (ActionBase & {
      readonly type: 'state'
      readonly operator: 'get'
    } & Props<{
        readonly key: string
        readonly namespace?: string
      }>)
  | (ActionBase & {
      readonly type: 'state'
      readonly operator: 'set'
    } & Props<{
        readonly key: string
        readonly value: string
        readonly namespace?: string
        readonly ttl?: string
      }>)
  | (ActionBase & {
      readonly type: 'state'
      readonly operator: 'increment'
    } & Props<{
        readonly key: string
        readonly amount?: number
        readonly namespace?: string
      }>)
  | (ActionBase & {
      readonly type: 'state'
      readonly operator: 'delete'
    } & Props<{
        readonly key: string
        readonly namespace?: string
      }>)
  | (ActionBase & {
      readonly type: 'state'
      readonly operator: 'list'
    } & Props<{
        readonly prefix?: string
        readonly namespace?: string
        readonly limit?: number
      }>)
  // ── digest (2 operator variants) ──
  | (ActionBase & {
      readonly type: 'digest'
      readonly operator: 'collect'
    } & Props<{
        readonly digestKey: string
        readonly item: string
        readonly deduplicateBy?: string
      }>)
  | (ActionBase & {
      readonly type: 'digest'
      readonly operator: 'release'
    } & Props<{
        readonly digestKey: string
        readonly sort?: { readonly field: string; readonly direction?: 'asc' | 'desc' }
        readonly limit?: number
      }>)
  // ── crypto (2 operator variants) ──
  | (ActionBase & {
      readonly type: 'crypto'
      readonly operator: 'hash'
    } & Props<{
        readonly input: string
        readonly algorithm: 'md5' | 'sha256' | 'sha512'
        readonly encoding?: 'hex' | 'base64'
      }>)
  | (ActionBase & {
      readonly type: 'crypto'
      readonly operator: 'hmac'
    } & Props<{
        readonly input: string
        readonly secret: string
        readonly algorithm: 'sha256' | 'sha512'
        readonly encoding?: 'hex' | 'base64'
      }>)
  // ── date (8 operator variants) ──
  | (ActionBase & {
      readonly type: 'date'
      readonly operator: 'format'
    } & Props<{
        readonly input: string
        readonly pattern: string
        readonly timezone?: string
        readonly locale?: string
      }>)
  | (ActionBase & {
      readonly type: 'date'
      readonly operator: 'parse'
    } & Props<{
        readonly input: string
        readonly pattern: string
        readonly timezone?: string
      }>)
  | (ActionBase & {
      readonly type: 'date'
      readonly operator: 'add'
    } & Props<{
        readonly input: string
        readonly years?: number
        readonly months?: number
        readonly weeks?: number
        readonly days?: number
        readonly hours?: number
        readonly minutes?: number
        readonly seconds?: number
        readonly timezone?: string
      }>)
  | (ActionBase & {
      readonly type: 'date'
      readonly operator: 'subtract'
    } & Props<{
        readonly input: string
        readonly years?: number
        readonly months?: number
        readonly weeks?: number
        readonly days?: number
        readonly hours?: number
        readonly minutes?: number
        readonly seconds?: number
        readonly timezone?: string
      }>)
  | (ActionBase & {
      readonly type: 'date'
      readonly operator: 'diff'
    } & Props<{
        readonly from: string
        readonly to: string
        readonly unit:
          'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond'
        readonly timezone?: string
      }>)
  | (ActionBase & {
      readonly type: 'date'
      readonly operator: 'startOf'
    } & Props<{
        readonly input: string
        readonly unit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'
        readonly timezone?: string
      }>)
  | (ActionBase & {
      readonly type: 'date'
      readonly operator: 'endOf'
    } & Props<{
        readonly input: string
        readonly unit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'
        readonly timezone?: string
      }>)
  | (ActionBase & {
      readonly type: 'date'
      readonly operator: 'now'
    } & Props<{
        readonly pattern?: string
        readonly timezone?: string
        readonly locale?: string
      }>)
  // ── flow ──
  | (ActionBase & {
      readonly type: 'flow'
      readonly operator: 'stop'
    } & Props<{
        readonly message?: string
        readonly status?: 'success' | 'error'
        readonly output?: { readonly [key: string]: unknown }
      }>)
  // ── sovrium ──
  | (ActionBase & {
      readonly type: 'sovrium'
      readonly operator: 'validateConfig'
    } & Props<{
        readonly config: string | { readonly [key: string]: unknown }
        readonly format?: 'json' | 'yaml' | 'auto'
      }>)
  // ── delay:webhook (new operator) ──
  | (ActionBase & {
      readonly type: 'delay'
      readonly operator: 'webhook'
    } & Props<{
        readonly callbackId?: string
        readonly timeout?: string
        readonly onTimeout?: 'continue' | 'stop' | 'error'
        readonly expectedData?: { readonly [key: string]: unknown }
      }>)
  // ── ai:agent (new operator) ──
  | (ActionBase & {
      readonly type: 'ai'
      readonly operator: 'agent'
    } & Props<{
        readonly agent: string
        readonly task: string
        readonly context?: { readonly [key: string]: unknown }
        readonly maxSteps?: number
        readonly responseFormat?: 'text' | 'json'
        readonly timeout?: number
        readonly connection?: string
      }>)
  // ── ref (no operator) ──
  | (ActionBase & {
      readonly type: 'ref'
      readonly $ref: string
      readonly $vars?: { readonly [key: string]: unknown }
    })

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
  WebhookActionSchema,
  DelayActionSchema,
  AutomationActionSchema,
  AiActionSchema,
  ApprovalActionSchema,
  FileActionSchema,
  DataActionSchema,
  StateActionSchema,
  DigestActionSchema,
  CryptoActionSchema,
  DateActionSchema,
  FlowActionSchema,
  SovriumActionSchema,
  ActionRefSchema,
]).pipe(
  Schema.annotate({
    // MUST stay distinct from the component-action union's `Action` identifier
    // (`src/domain/models/app/pages/components/action.ts`). Effect keys JSON
    // Schema `$defs` by `identifier`, so two schemas sharing one identifier
    // collapse into a single `$def`: one union is published and the other is
    // erased. That is what happened here — every automation action
    // (`file/generatePdf`, `http/request`, `email/send`, …) was missing from
    // the public schema at https://sovrium.com/schema/app.json that config
    // authors are told to validate against. Guarded by the identifier
    // collision + action-coverage tests in
    // `src/domain/services/json-schema.test.ts`.
    identifier: 'AutomationAction',
    title: 'Automation Action',
    description:
      'An individual step in an automation workflow. Structure: type + operator + props.',
  })
) as Schema.Codec<Action, unknown>

// Re-export all action type schemas
export * from './ai'
export * from './analytics'
export * from './approval'
export * from './auth'
export * from './automation'
export * from './base'
export * from './code'
export * from './crypto'
export * from './data'
export * from './date'
export * from './delay'
export * from './digest'
export * from './email'
export * from './file'
export * from './filter'
export * from './flow'
export * from './http'
export * from './loop'
export * from './path'
export * from './record'
export * from './ref'
export * from './sovrium'
export * from './state'
export * from './webhook'
