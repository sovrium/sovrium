/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type { AutomationDigestRepository } from '@/application/ports/repositories/automations/automation-digest-repository'
import type { AutomationStateRepository } from '@/application/ports/repositories/automations/automation-state-repository'
import type { CloudHostRegistryRepository } from '@/application/ports/repositories/cloud/cloud-host-registry-repository'
import type { CloudIngressRepository } from '@/application/ports/repositories/cloud/cloud-ingress-repository'
import type { CloudQuotaRepository } from '@/application/ports/repositories/cloud/cloud-quota-repository'
import type { CloudSupervisorRepository } from '@/application/ports/repositories/cloud/cloud-supervisor-repository'
import type { CloudTenantDatabasesRepository } from '@/application/ports/repositories/cloud/cloud-tenant-databases-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { AiService } from '@/application/ports/services/ai-service'
import type { ImageTransformService } from '@/application/ports/services/image-transform-service'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'
import type { PackageResolver } from '@/infrastructure/automations/package-resolver'

export interface ActionOutcome {
  readonly status: 'success' | 'failure' | 'filtered'
  readonly error?: string
  readonly output?: Record<string, unknown>
  readonly responseOverride?: Readonly<Record<string, unknown>>
  readonly returnData?: Readonly<Record<string, unknown>>
  readonly pause?: boolean
}

export interface AutomationContext {
  readonly name: string
  readonly id: string
  readonly userId?: string
  readonly runId?: string
}

export interface ActionRunContext {
  readonly previousSteps: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly triggerData: Readonly<Record<string, unknown>>
  readonly rawAction: Readonly<Record<string, unknown>>
  readonly envLookup: Readonly<Record<string, string>>
  readonly invokeTemplate?: (
    name: string,
    vars?: Readonly<Record<string, unknown>>
  ) => Promise<unknown>

  readonly invokeNativeAction?: (
    type: string,
    operator: string,
    props?: Readonly<Record<string, unknown>>
  ) => Promise<unknown>

  readonly invokeAutomation?: (input: {
    readonly name: string
    readonly inputData: Readonly<Record<string, unknown>>
    readonly mode: 'sync' | 'async'
    readonly maxDepth: number
  }) => Promise<{ readonly result: Readonly<Record<string, unknown>> }>

  readonly attempt?: number

  readonly stepIndex?: number
}

export type ActionHandler = (
  action: Readonly<Record<string, unknown>>,
  app: App,
  automation: AutomationContext,
  runContext?: ActionRunContext
) => Effect.Effect<
  ActionOutcome,
  never,
  | TableRepository
  | AutomationStateRepository
  | AutomationDigestRepository
  | CloudHostRegistryRepository
  | CloudIngressRepository
  | CloudQuotaRepository
  | CloudSupervisorRepository
  | CloudTenantDatabasesRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | PackageResolver
  | AiService
  | StorageService
  | ImageTransformService
  | AnalyticsRepository
>

export type ActionKey = string

export const actionKey = (type: string | undefined, operator: string | undefined): ActionKey =>
  operator ? `${type ?? ''}/${operator}` : (type ?? '')


export const stringProp = (props: Readonly<Record<string, unknown>>, key: string): string =>
  String(props[key] ?? '')

export const recordProp = (
  props: Readonly<Record<string, unknown>>,
  key: string
): Record<string, unknown> | undefined => props[key] as Record<string, unknown> | undefined

export const numberProp = (
  props: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number
): number => {
  const raw = props[key]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export class BodySerializationError extends Data.TaggedError('BodySerializationError')<{
  readonly message: string
  readonly cause: unknown
}> {}

export const serializeActionBody = (
  rawBody: unknown
): Effect.Effect<string | undefined, BodySerializationError> => {
  if (rawBody === undefined || typeof rawBody === 'string') {
    return Effect.succeed(rawBody)
  }
  return Effect.try({
    try: () => JSON.stringify(rawBody),
    catch: (cause) =>
      new BodySerializationError({
        message: `failed to serialise body: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  })
}
