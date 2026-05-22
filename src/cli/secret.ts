/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { randomBytes } from 'node:crypto'
import { Effect, Console } from 'effect'

interface NamedSecret {
  readonly envVar: string
  readonly value: string
}

const generateSecretValue = (): string => randomBytes(32).toString('hex')

const AUTH_SECRET = 'AUTH_SECRET'
const ENCRYPTION_KEY = 'SOVRIUM_ENCRYPTION_KEY'

const resolveScope = (scope?: string): readonly NamedSecret[] | undefined => {
  const normalized = scope?.toLowerCase()

  if (normalized === undefined || normalized === 'all') {
    return [
      { envVar: AUTH_SECRET, value: generateSecretValue() },
      { envVar: ENCRYPTION_KEY, value: generateSecretValue() },
    ]
  }
  if (normalized === 'auth') {
    return [{ envVar: AUTH_SECRET, value: generateSecretValue() }]
  }
  if (normalized === 'encryption') {
    return [{ envVar: ENCRYPTION_KEY, value: generateSecretValue() }]
  }
  return undefined
}

export const handleSecretCommand = async (subcommand?: string, scope?: string): Promise<void> => {
  if (subcommand !== 'generate') {
    Effect.runSync(
      Console.error(
        'Error: Unknown secret subcommand\n\nUsage:\n  sovrium secret generate [auth|encryption|all]   Print fresh secret(s) as .env lines'
      )
    )
    process.exit(1)
  }

  const secrets = resolveScope(scope)

  if (secrets === undefined) {
    Effect.runSync(
      Console.error(
        `Error: Unknown secret scope "${scope ?? ''}"\n\nValid scopes: auth, encryption, all (default)`
      )
    )
    process.exit(1)
  }

  const envLines = secrets.map((secret) => `${secret.envVar}=${secret.value}`).join('\n')
  Effect.runSync(
    Effect.gen(function* () {
      yield* Console.log(envLines)
      yield* Console.error(
        '\nThese secrets are NOT stored — copy them into your .env or deployment environment now.'
      )
    })
  )
}
