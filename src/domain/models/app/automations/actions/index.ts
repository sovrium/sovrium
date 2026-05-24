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
import { StateActionSchema } from './state'
import { WebhookActionSchema } from './webhook'
import type { ConditionGroup } from '../conditions'
import type { RetryConfig } from '../retry'


export interface ActionBase {
  readonly name: string
  readonly label?: string
  readonly retry?: RetryConfig
  readonly continueOnError?: boolean
  readonly timeout?: number
}

export interface PathBranch {
  readonly name: string
  readonly condition?: ConditionGroup
  readonly actions: readonly Action[]
}

type Props<T> = { readonly props: T }

export type Action =
  | (ActionBase & {
      readonly type: 'code'
      readonly operator: 'runTypescript'
    } & Props<{
        readonly code: string
        readonly inputData?: { readonly [key: string]: unknown }
        readonly packages?: readonly string[]
        readonly timeout?: number
      }>)
  | (ActionBase & {
      readonly type: 'http'
      readonly operator: 'request'
    } & Props<{
        readonly url: string
        readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | string
        readonly headers?: { readonly [key: string]: string }
        readonly body?: string | { readonly [key: string]: unknown }
        readonly contentType?: 'json' | 'form' | 'text' | 'xml'
        readonly timeout?: number
        readonly expectedStatus?: readonly number[]
      }>)
  | (ActionBase & {
      readonly type: 'http'
      readonly operator: 'get'
    } & Props<{
        readonly url: string
        readonly headers?: { readonly [key: string]: string }
        readonly timeout?: number
        readonly expectedStatus?: readonly number[]
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
        readonly expectedStatus?: readonly number[]
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
        readonly expectedStatus?: readonly number[]
        readonly connection?: string
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'create'
    } & Props<{
        readonly table: string
        readonly data: { readonly [key: string]: unknown }
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
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'delete'
    } & Props<{
        readonly table: string
        readonly filter: ConditionGroup
      }>)
  | (ActionBase & {
      readonly type: 'filter'
      readonly operator: 'continue'
    } & Props<{
        readonly condition: ConditionGroup
        readonly onFalse?: 'stop' | 'skip'
      }>)
  | (ActionBase & {
      readonly type: 'path'
      readonly operator: 'branch'
    } & Props<{
        readonly paths: readonly PathBranch[]
        readonly mode?: 'first-match' | 'all-matching'
      }>)
  | (ActionBase & {
      readonly type: 'loop'
      readonly operator: 'each'
    } & Props<{
        readonly items: string
        readonly actions: readonly Action[]
        readonly maxIterations?: number
        readonly continueOnItemError?: boolean
      }>)
  | (ActionBase & {
      readonly type: 'email'
      readonly operator: 'send'
    } & Props<{
        readonly to: string
        readonly subject: string
        readonly body: string
        readonly from?: string
        readonly cc?: string | readonly string[]
        readonly bcc?: string | readonly string[]
        readonly replyTo?: string | readonly string[]
      }>)
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
  | (ActionBase & {
      readonly type: 'analytics'
      readonly operator: 'track'
    } & Props<{
        readonly event: string
        readonly properties?: { readonly [key: string]: unknown }
      }>)
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
  | (ActionBase & {
      readonly type: 'delay'
      readonly operator: 'wait'
    } & Props<{
        readonly duration?: string
        readonly until?: string
      }>)
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
      readonly type: 'ai'
      readonly operator: 'generate'
    } & Props<{
        readonly provider: 'openai' | 'anthropic' | 'ollama' | 'custom'
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
        readonly provider: 'openai' | 'anthropic' | 'ollama' | 'custom'
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
        readonly provider: 'openai' | 'anthropic' | 'ollama' | 'custom'
        readonly model: string
        readonly input: string
        readonly schema: { readonly [key: string]: unknown }
        readonly connection?: string
        readonly baseUrl?: string
      }>)
  | (ActionBase & {
      readonly type: 'approval'
      readonly operator: 'request'
    } & Props<{
        readonly approvers: 'all-admins' | readonly string[]
        readonly message: string
        readonly options?: readonly {
          readonly value: string
          readonly label?: string
        }[]
        readonly timeout?: string
        readonly onTimeout?: 'approve' | 'reject' | 'escalate'
        readonly notifyVia?: 'email' | 'webhook' | 'both'
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'batchCreate'
    } & Props<{
        readonly table: string
        readonly items: string
        readonly batchSize?: number
        readonly continueOnItemError?: boolean
      }>)
  | (ActionBase & {
      readonly type: 'record'
      readonly operator: 'batchUpdate'
    } & Props<{
        readonly table: string
        readonly items: string
        readonly batchSize?: number
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
        readonly fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
        readonly format?: 'jpeg' | 'png' | 'webp' | 'avif'
        readonly quality?: number
        readonly crop?: {
          readonly x: number
          readonly y: number
          readonly width: number
          readonly height: number
        }
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
  | (ActionBase & {
      readonly type: 'digest'
      readonly operator: 'collect'
    } & Props<{
        readonly bucket: string
        readonly item: string
        readonly deduplicateBy?: string
      }>)
  | (ActionBase & {
      readonly type: 'digest'
      readonly operator: 'release'
    } & Props<{
        readonly bucket: string
        readonly sort?: { readonly field: string; readonly direction?: 'asc' | 'desc' }
        readonly limit?: number
      }>)
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
  | (ActionBase & {
      readonly type: 'flow'
      readonly operator: 'stop'
    } & Props<{
        readonly message?: string
        readonly status?: 'success' | 'error'
        readonly output?: { readonly [key: string]: unknown }
      }>)
  | (ActionBase & {
      readonly type: 'delay'
      readonly operator: 'webhook'
    } & Props<{
        readonly callbackId?: string
        readonly timeout?: string
        readonly onTimeout?: 'continue' | 'stop' | 'error'
        readonly expectedData?: { readonly [key: string]: unknown }
      }>)
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
  | (ActionBase & {
      readonly type: 'ref'
      readonly $ref: string
      readonly $vars?: { readonly [key: string]: unknown }
    })


export const ActionSchema: Schema.Schema<Action, unknown> = Schema.Union(
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
  FlowActionSchema,
  ActionRefSchema
).pipe(
  Schema.annotations({
    identifier: 'Action',
    title: 'Automation Action',
    description:
      'An individual step in an automation workflow. Structure: type + operator + props.',
  })
) as Schema.Schema<Action, unknown>

export * from './ai'
export * from './analytics'
export * from './approval'
export * from './auth'
export * from './automation'
export * from './base'
export * from './code'
export * from './crypto'
export * from './data'
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
export * from './state'
export * from './webhook'
