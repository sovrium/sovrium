/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CloudHostRegistryRepository } from '@/application/ports/repositories/cloud/cloud-host-registry-repository'
import { CloudIngressRepository } from '@/application/ports/repositories/cloud/cloud-ingress-repository'
import { CloudQuotaRepository } from '@/application/ports/repositories/cloud/cloud-quota-repository'
import { CloudSupervisorRepository } from '@/application/ports/repositories/cloud/cloud-supervisor-repository'
import { CloudTenantDatabasesRepository } from '@/application/ports/repositories/cloud/cloud-tenant-databases-repository'
import { tailRecentLines } from '@/infrastructure/cloud/log-drain'
import { numberProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'
import type { CloudHostRegistryRecord } from '@/application/ports/repositories/cloud/cloud-host-registry-repository'
import type { App } from '@/domain/models/app'


const isCloudModeEnabled = (): boolean => {
  const flag = process.env.SOVRIUM_CLOUD_MODE
  return typeof flag === 'string' && flag.trim().length > 0
}

const OPERATOR_BUILDERS: Readonly<
  Record<string, (props: Readonly<Record<string, unknown>>) => CloudHostRegistryRecord | undefined>
> = {
  'provision-db': (props) => {
    const target = stringProp(props, 'dbName')
    return target ? { effect: 'provision-db', target } : undefined
  },
  'spawn-app': (props) => {
    const target = stringProp(props, 'appSlug')
    return target
      ? {
          effect: 'spawn-app',
          target,
          status: 'running',
          configRef: stringProp(props, 'configRef'),
        }
      : undefined
  },
  'route-add': (props) => {
    const target = stringProp(props, 'domain')
    return target ? { effect: 'route-add', target, port: numberProp(props, 'port', 0) } : undefined
  },
  'disable-app': (props) => {
    const target = stringProp(props, 'appSlug')
    return target ? { effect: 'disable-app', target, status: 'stopped' } : undefined
  },
  'destroy-app': (props) => {
    const target = stringProp(props, 'appSlug')
    return target ? { effect: 'destroy-app', target, status: 'destroyed' } : undefined
  },
  'scale-app': (props) => {
    const target = stringProp(props, 'appSlug')
    return target
      ? { effect: 'scale-app', target, containerSize: stringProp(props, 'containerSize') }
      : undefined
  },
  'set-version': (props) => {
    const target = stringProp(props, 'appSlug')
    return target
      ? { effect: 'set-version', target, version: stringProp(props, 'version') }
      : undefined
  },
  'tail-logs': (props) => {
    const target = stringProp(props, 'appSlug')
    return target
      ? { effect: 'tail-logs', target, lines: numberProp(props, 'lines', 100) }
      : undefined
  },
}

const maintainTenantDatabaseRegistry = (
  operator: string,
  props: Readonly<Record<string, unknown>>
): Effect.Effect<string | undefined, never, CloudTenantDatabasesRepository> =>
  Effect.gen(function* () {
    const repo = yield* CloudTenantDatabasesRepository

    if (operator === 'provision-db') {
      const dbName = stringProp(props, 'dbName')
      if (!dbName) return undefined
      const result = yield* Effect.either(repo.provision(dbName))
      return result._tag === 'Left' ? String(result.left.cause) : undefined
    }

    if (operator === 'destroy-app') {
      const appSlug = stringProp(props, 'appSlug')
      if (!appSlug) return undefined
      const result = yield* Effect.either(repo.drop(`tenant_${appSlug}`))
      return result._tag === 'Left' ? String(result.left.cause) : undefined
    }

    return undefined
  })

const resolveSpawnVersion = (runContext?: ActionRunContext): string => {
  const body = runContext?.triggerData?.['body']
  if (body !== null && typeof body === 'object' && 'version' in body) {
    const { version } = body as Record<string, unknown>
    if (typeof version === 'string') return version
  }
  return ''
}

const TIER_CPU_LIMIT: Readonly<Record<string, number>> = {
  S: 1024,
  M: 2048,
  L: 4096,
  XL: 8192,
}

const DEFAULT_TIER = 'S'

const DEFAULT_CPU_LIMIT = 1024

const resolveSpawnContainerSize = (runContext?: ActionRunContext): string => {
  const body = runContext?.triggerData?.['body']
  if (body !== null && typeof body === 'object' && 'containerSize' in body) {
    const { containerSize } = body as Record<string, unknown>
    if (typeof containerSize === 'string' && containerSize in TIER_CPU_LIMIT) {
      return containerSize
    }
  }
  return DEFAULT_TIER
}

const maintainQuotaRegistry = (
  operator: string,
  props: Readonly<Record<string, unknown>>,
  runContext?: ActionRunContext
): Effect.Effect<string | undefined, never, CloudQuotaRepository> =>
  Effect.gen(function* () {
    if (operator !== 'spawn-app') return undefined

    const appSlug = stringProp(props, 'appSlug')
    if (!appSlug) return undefined

    const containerSize = resolveSpawnContainerSize(runContext)
    const cpuLimit = TIER_CPU_LIMIT[containerSize] ?? DEFAULT_CPU_LIMIT

    const repo = yield* CloudQuotaRepository
    const result = yield* Effect.either(repo.applyTier(appSlug, containerSize, cpuLimit))
    return result._tag === 'Left' ? String(result.left.cause) : undefined
  })

const maintainSupervisorRegistry = (
  operator: string,
  props: Readonly<Record<string, unknown>>,
  runContext?: ActionRunContext
): Effect.Effect<string | undefined, never, CloudSupervisorRepository> =>
  Effect.gen(function* () {
    const repo = yield* CloudSupervisorRepository
    const appSlug = stringProp(props, 'appSlug')
    if (!appSlug) return undefined

    if (operator === 'spawn-app') {
      const version = resolveSpawnVersion(runContext)
      const registered = yield* Effect.either(repo.register(appSlug, version))
      if (registered._tag === 'Left') return String(registered.left.cause)
      const envRecorded = yield* Effect.either(repo.recordEnv(appSlug, []))
      if (envRecorded._tag === 'Left') return String(envRecorded.left.cause)
      const envInjected = yield* Effect.either(repo.injectEnv(appSlug))
      return envInjected._tag === 'Left' ? String(envInjected.left.cause) : undefined
    }

    if (operator === 'disable-app') {
      const result = yield* Effect.either(repo.stop(appSlug))
      return result._tag === 'Left' ? String(result.left.cause) : undefined
    }

    if (operator === 'destroy-app') {
      const result = yield* Effect.either(repo.remove(appSlug))
      return result._tag === 'Left' ? String(result.left.cause) : undefined
    }

    return undefined
  })

const maintainTailLogsEffect = (
  operator: string,
  props: Readonly<Record<string, unknown>>,
  app: App
): Effect.Effect<string | undefined, never, never> =>
  Effect.gen(function* () {
    if (operator !== 'tail-logs') return undefined
    const appSlug = stringProp(props, 'appSlug')
    if (!appSlug) return undefined
    const lines = numberProp(props, 'lines', 100)
    yield* Effect.promise(() => tailRecentLines(app, appSlug, lines))
    return undefined
  })

const maintainIngressRegistry = (
  operator: string,
  props: Readonly<Record<string, unknown>>
): Effect.Effect<string | undefined, never, CloudIngressRepository> =>
  Effect.gen(function* () {
    if (operator !== 'route-add') return undefined

    const domain = stringProp(props, 'domain')
    if (!domain) return undefined
    const port = numberProp(props, 'port', 0)

    const repo = yield* CloudIngressRepository

    const attached = yield* Effect.either(repo.attachRoute(domain, port))
    if (attached._tag === 'Left') return String(attached.left.cause)

    const verified = yield* Effect.either(repo.verifyCustomDomain(domain))
    if (verified._tag === 'Left') return String(verified.left.cause)

    const issued = yield* Effect.either(repo.issueTls(domain))
    return issued._tag === 'Left' ? String(issued.left.cause) : undefined
  })

const maintainSecondaryRegistries = (
  operator: string,
  props: Readonly<Record<string, unknown>>,
  app: App,
  runContext?: ActionRunContext
): Effect.Effect<
  string | undefined,
  never,
  | CloudTenantDatabasesRepository
  | CloudSupervisorRepository
  | CloudIngressRepository
  | CloudQuotaRepository
> =>
  Effect.gen(function* () {
    const tenantError = yield* maintainTenantDatabaseRegistry(operator, props)
    if (tenantError !== undefined) return tenantError
    const supervisorError = yield* maintainSupervisorRegistry(operator, props, runContext)
    if (supervisorError !== undefined) return supervisorError
    const quotaError = yield* maintainQuotaRegistry(operator, props, runContext)
    if (quotaError !== undefined) return quotaError
    const ingressError = yield* maintainIngressRegistry(operator, props)
    if (ingressError !== undefined) return ingressError
    return yield* maintainTailLogsEffect(operator, props, app)
  })

export const handleCloud: ActionHandler = (action, app, _automation, runContext) =>
  Effect.gen(function* () {
    if (!isCloudModeEnabled()) {
      return {
        status: 'failure',
        error:
          'cloud action requires the Sovrium Cloud host gate (SOVRIUM_CLOUD_MODE); this instance is not running in cloud mode',
      } as const satisfies ActionOutcome
    }

    const operator = stringProp(action as Record<string, unknown>, 'operator')
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}

    const builder = OPERATOR_BUILDERS[operator]
    if (!builder) {
      return {
        status: 'failure',
        error: `cloud action received an unknown operator: ${operator}`,
      } as const satisfies ActionOutcome
    }

    const record = builder(props)
    if (!record) {
      return {
        status: 'failure',
        error: `cloud.${operator} is missing a required prop`,
      } as const satisfies ActionOutcome
    }

    const repo = yield* CloudHostRegistryRepository
    const result = yield* Effect.either(repo.record(record))
    if (result._tag === 'Left') {
      return {
        status: 'failure',
        error: String(result.left.cause),
      } as const satisfies ActionOutcome
    }

    const secondaryError = yield* maintainSecondaryRegistries(operator, props, app, runContext)
    if (secondaryError !== undefined) {
      return { status: 'failure', error: secondaryError } as const satisfies ActionOutcome
    }

    return { status: 'success' } as const satisfies ActionOutcome
  })
