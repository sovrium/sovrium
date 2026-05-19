/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildEnvLookup, ENV_REFERENCE_PATTERN } from './resolve-env-vars'
import { mapStringsDeep } from './value-walker'
import type { EnvVar } from '@/domain/models/app/env'

export const redactSecretsInValue = (
  value: unknown,
  envLookup: Readonly<Record<string, string>>
): unknown => {
  const secrets = collectSecrets(envLookup)
  if (secrets.length === 0) return value
  return walkAndRedact(value, secrets)
}

const collectSecrets = (envLookup: Readonly<Record<string, string>>): readonly string[] =>
  Object.values(envLookup).filter((v) => v.length > 0)

const walkAndRedact = (value: unknown, secrets: readonly string[]): unknown =>
  mapStringsDeep(value, (s) => redactString(s, secrets))

const redactString = (input: string, secrets: readonly string[]): string =>
  secrets.reduce((acc, secret) => acc.split(secret).join('***'), input)

export const redactSecretsForEnv = (
  value: unknown,
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>
): unknown => {
  if (!envVars || envVars.length === 0) return value
  return redactSecretsInValue(value, buildEnvLookup(envVars, processEnv))
}

const SECRET_PROP_KEYS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  oauth2: ['clientSecret'],
  apiKey: ['key'],
  basic: ['password'],
  bearer: ['token'],
}

const containsEnvReference = (value: string): boolean =>
  new RegExp(ENV_REFERENCE_PATTERN.source).test(value)

const secretsFromConnection = (conn: Readonly<Record<string, unknown>>): readonly string[] => {
  const type = String(conn['type'] ?? '')
  const keys = SECRET_PROP_KEYS_BY_TYPE[type]
  if (!keys) return []
  const props = conn['props'] as Record<string, unknown> | undefined
  if (props === undefined) return []
  return keys
    .map((key) => props[key])
    .filter((val): val is string => typeof val === 'string' && val.length > 0)
    .filter((val) => !containsEnvReference(val))
}

export const collectConnectionSecrets = (
  connections: ReadonlyArray<Readonly<Record<string, unknown>>> | undefined
): readonly string[] => {
  if (!connections || connections.length === 0) return []
  return connections.flatMap((conn) => secretsFromConnection(conn))
}

export const redactSecretsForApp = (
  value: unknown,
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>,
  connections: ReadonlyArray<Readonly<Record<string, unknown>>> | undefined
): unknown => {
  const connectionSecrets = collectConnectionSecrets(connections)
  const afterConnections =
    connectionSecrets.length === 0 ? value : walkAndRedact(value, connectionSecrets)
  return redactSecretsForEnv(afterConnections, envVars, processEnv)
}
