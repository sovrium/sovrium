/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Duration, Effect } from 'effect'
import type { ActionHandler, ActionKey, ActionOutcome, AutomationContext } from '../action-handlers'
import type { TriggerData } from '../resolve-trigger-data'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type { AutomationDigestRepository } from '@/application/ports/repositories/automations/automation-digest-repository'
import type { AutomationRepository } from '@/application/ports/repositories/automations/automation-repository'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type { AutomationStateRepository } from '@/application/ports/repositories/automations/automation-state-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { AiService } from '@/application/ports/services/ai-service'
import type { ImageTransformService } from '@/application/ports/services/image-transform-service'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'
import type { PackageResolver } from '@/infrastructure/automations/package-resolver'

export interface ExecutedStep {
  readonly name: string
  readonly type: string
  readonly operator?: string
  readonly status: 'success' | 'failure' | 'filtered' | 'skipped'
  readonly error?: string
  readonly props?: Record<string, unknown>
  readonly output?: Record<string, unknown>
}

export interface RunAccumulator {
  readonly steps: ReadonlyArray<ExecutedStep>
  readonly runStatus:
    | 'success'
    | 'failure'
    | 'timed-out'
    | 'exhausted'
    | 'completed-with-errors'
    | 'skipped'
    | 'cancelled'
    | 'waiting-approval'
    | 'queued'
    | 'running'
  readonly runError: string | undefined
  readonly actions: Readonly<Record<string, Record<string, unknown>>>
  readonly lastOutput: Record<string, unknown> | undefined
  readonly halted: boolean
  readonly responseOverride: Readonly<Record<string, unknown>> | undefined
  readonly returnData: Readonly<Record<string, unknown>> | undefined
}

export interface StepContext {
  readonly app: App
  readonly envLookup: Readonly<Record<string, string>>
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly templateContext: Readonly<Record<string, unknown>>
  readonly automation: AutomationContext
  readonly triggerData: Readonly<Record<string, unknown>>
  readonly automationRetry: ResolvedRetryConfig | undefined
  readonly callDepth: number
  readonly visitedAutomations: ReadonlySet<string>
}

export interface ResolvedRetryConfig {
  readonly maxAttempts: number
  readonly delayMs: number
  readonly strategy: 'fixed' | 'exponential'
}

export type StepRequirements =
  | TableRepository
  | AutomationStateRepository
  | AutomationDigestRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | AnalyticsRepository
  | PackageResolver
  | AiService
  | StorageService
  | ImageTransformService

export type RunRequirements =
  | TableRepository
  | AutomationRepository
  | AutomationRunRepository
  | AutomationStateRepository
  | AutomationDigestRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | AnalyticsRepository
  | PackageResolver
  | AiService
  | StorageService
  | ImageTransformService

export interface RuntimeActionTemplate {
  readonly name: string
  readonly action: Readonly<Record<string, unknown>>
  readonly variables?: Readonly<Record<string, unknown>>
}

export interface RunAutomationResult {
  readonly runId: string
  readonly status:
    | 'success'
    | 'failure'
    | 'timed-out'
    | 'exhausted'
    | 'completed-with-errors'
    | 'skipped'
    | 'cancelled'
    | 'waiting-approval'
  readonly actions: Readonly<Record<string, Record<string, unknown>>>
  readonly lastOutput?: Record<string, unknown>
  readonly error?: string
  readonly responseOverride?: Readonly<Record<string, unknown>>
  readonly returnData?: Readonly<Record<string, unknown>>
}

export interface ExecuteAutomationRunInput {
  readonly name: string
  readonly automation: NonNullable<App['automations']>[number]
  readonly automationId: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId: string | undefined
  readonly callDepth?: number
  readonly visitedAutomations?: ReadonlySet<string>
  readonly skipActionNames?: ReadonlySet<string>
  readonly onPersisted?: (runId: string) => void
}

export type AutomationInvoker = (input: {
  readonly name: string
  readonly inputData: Readonly<Record<string, unknown>>
  readonly mode: 'sync' | 'async'
  readonly maxDepth: number
}) => Promise<{ readonly result: Readonly<Record<string, unknown>> }>

export const EMPTY_RUN_ACCUMULATOR: RunAccumulator = {
  steps: [],
  runStatus: 'success',
  runError: undefined,
  actions: {},
  lastOutput: undefined,
  halted: false,
  responseOverride: undefined,
  returnData: undefined,
}

const DEFAULT_RETRY_DELAY_MS = 50

const MAX_RETRY_DELAY_MS = 30_000

export const retryDelayMs = (retry: ResolvedRetryConfig, retryIndex: number): number => {
  const base = retry.delayMs > 0 ? retry.delayMs : DEFAULT_RETRY_DELAY_MS
  const raw = retry.strategy === 'exponential' ? base * 2 ** Math.max(0, retryIndex - 1) : base
  return Math.min(raw, MAX_RETRY_DELAY_MS)
}

export const toResolvedRetry = (raw: unknown): ResolvedRetryConfig | undefined => {
  if (raw === null || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const maxAttempts = typeof r['maxAttempts'] === 'number' ? r['maxAttempts'] : undefined
  if (maxAttempts === undefined || !Number.isFinite(maxAttempts) || maxAttempts < 1) {
    return undefined
  }
  const delayMs =
    typeof r['delayMs'] === 'number' && Number.isFinite(r['delayMs']) ? r['delayMs'] : 0
  const strategy: 'fixed' | 'exponential' =
    r['strategy'] === 'exponential' ? 'exponential' : 'fixed'
  return { maxAttempts: Math.floor(maxAttempts), delayMs, strategy }
}

export const resolveRetryForAction = (
  rawAction: Readonly<Record<string, unknown>>,
  automationRetry: ResolvedRetryConfig | undefined
): ResolvedRetryConfig | undefined => {
  const actionRetry = toResolvedRetry(rawAction['retry'])
  return actionRetry ?? automationRetry
}

export const sleepEffect = (ms: number): Effect.Effect<void> =>
  ms <= 0 ? Effect.void : Effect.sleep(Duration.millis(ms))

export const cryptoRandomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${String(Date.now())}-${String(Math.random()).slice(2, 10)}`
}

export const MAX_ERROR_LENGTH = 500
const TRUNCATION_SUFFIX = '… (truncated)'

export const truncateError = (input: string): string => {
  if (input.length <= MAX_ERROR_LENGTH) return input
  return input.slice(0, MAX_ERROR_LENGTH) + TRUNCATION_SUFFIX
}

export const isTerminalFailureStatus = (status: RunAccumulator['runStatus']): boolean =>
  status === 'failure' || status === 'exhausted' || status === 'cancelled'

export type { ActionOutcome }
