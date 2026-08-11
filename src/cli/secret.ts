/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium CLI - Secret commands
 *
 * `sovrium secret generate` prints freshly-generated, cryptographically
 * random secrets as paste-ready `.env` lines. Secrets are written to stdout
 * ONLY — never persisted to a file — so the operator decides where (and
 * whether) they are stored. This avoids a CLI silently writing a credential
 * to disk where it might be committed.
 *
 * Sub-arg selects scope:
 *   sovrium secret generate              → both AUTH_SECRET + SOVRIUM_ENCRYPTION_KEY
 *   sovrium secret generate all          → both (explicit)
 *   sovrium secret generate auth         → AUTH_SECRET only
 *   sovrium secret generate encryption   → SOVRIUM_ENCRYPTION_KEY only
 *
 * `sovrium secret adopt` deliberately BREAKS the rule above and writes a secret
 * to disk, so it owes an explanation. A server now provisions its own root
 * secret into `<dataDir>/encryption-key`; a deployment that has been supplying
 * `SOVRIUM_ENCRYPTION_KEY` by hand cannot simply drop the variable, because the
 * next boot would find no key file, GENERATE one, and silently orphan every
 * connection token the old key protected. `adopt` copies the key the operator
 * already has into the file the server will read, which is what makes removing
 * the variable a no-op instead of an invisible rotation.
 *
 * The 64-hex (256-bit) format matches `generatePlaintextToken()` in
 * application/use-cases/auth/bootstrap-token.ts. We generate inline here
 * rather than importing that module to keep this command free of the auth
 * stack it transitively pulls in.
 */

import { randomBytes } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Effect, Console } from 'effect'
import { defaultEncryptionKeyPath } from '@/domain/models/env/data-dir'

/** A generated secret destined for a specific env var. */
interface NamedSecret {
  readonly envVar: string
  readonly value: string
}

/** Generate a 256-bit (64 hex char) cryptographically random secret. */
const generateSecretValue = (): string => randomBytes(32).toString('hex')

const AUTH_SECRET = 'AUTH_SECRET'
const ENCRYPTION_KEY = 'SOVRIUM_ENCRYPTION_KEY'

/**
 * Resolve which secrets to emit from the (optional) scope argument.
 * Returns undefined for an unrecognized scope so the caller can error.
 */
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

/** Owner-read/write only — the file holds the key to every stored OAuth token. */
const KEY_FILE_MODE = 0o600

/** Read the already-persisted root secret, or `undefined` when there is none. */
const readPersistedSecret = (keyFilePath: string): string | undefined => {
  try {
    const contents = readFileSync(keyFilePath, 'utf-8').trim()
    return contents.length > 0 ? contents : undefined
  } catch {
    return undefined
  }
}

const failWith = (message: string): never => {
  Effect.runSync(Console.error(message))
  // eslint-disable-next-line functional/no-expression-statements -- CLI error exit
  process.exit(1)
}

/**
 * Write the key file, returning an operator-facing message on failure and
 * `undefined` on success.
 *
 * Returning the failure rather than throwing keeps the caller a straight-line
 * sequence of guarded returns, which is what the refusal semantics need to stay
 * readable: every branch here ends the command.
 */
const writeKeyFile = (keyFilePath: string, value: string): string | undefined => {
  try {
    // eslint-disable-next-line functional/no-expression-statements -- filesystem provisioning
    mkdirSync(dirname(keyFilePath), { recursive: true })
    writeFileSync(keyFilePath, `${value}\n`, { mode: KEY_FILE_MODE, encoding: 'utf-8' })
    // `mode` applies only on creation and is masked by umask, so the bits are
    // asserted explicitly rather than hoped for.
    chmodSync(keyFilePath, KEY_FILE_MODE)
    return undefined
  } catch (cause) {
    return (
      `Error: could not write the encryption key to ${keyFilePath} ` +
      `(${cause instanceof Error ? cause.message : String(cause)}).`
    )
  }
}

/**
 * Persist `$SOVRIUM_ENCRYPTION_KEY` to `<dataDir>/encryption-key`.
 *
 * Three outcomes, and the third is the point of the verb existing:
 *   - nothing in the environment → refuse, naming the variable it expected,
 *     rather than writing an empty or invented key;
 *   - the same key already persisted → succeed silently (a deploy script may
 *     run this on every release);
 *   - a DIFFERENT key already persisted → REFUSE and leave the file alone.
 *     Overwriting would make everything encrypted under the persisted key
 *     unreadable, which is the exact silent data loss this whole change exists
 *     to close. Only the operator knows which of the two keys is authoritative.
 */
const handleAdoptCommand = (): void => {
  const envKey = process.env['SOVRIUM_ENCRYPTION_KEY']
  const keyFilePath = defaultEncryptionKeyPath()

  if (typeof envKey !== 'string' || envKey.length === 0) {
    return failWith(
      'Error: nothing to adopt — SOVRIUM_ENCRYPTION_KEY is not set.\n\n' +
        '`sovrium secret adopt` persists the key this process already has so the\n' +
        'environment variable can be removed without rotating it. Set\n' +
        'SOVRIUM_ENCRYPTION_KEY to the value currently in use and re-run.'
    )
  }

  const persisted = readPersistedSecret(keyFilePath)
  if (persisted !== undefined && persisted !== envKey) {
    return failWith(
      `Error: a different encryption key is already persisted at ${keyFilePath}.\n\n` +
        'Adopting over it would make everything encrypted under the persisted key\n' +
        'unreadable. Decide which key is authoritative: keep the persisted one by\n' +
        'unsetting SOVRIUM_ENCRYPTION_KEY, or remove the file first if the value in\n' +
        'the environment is the one your data was encrypted with.'
    )
  }

  if (persisted === envKey) {
    return Effect.runSync(Console.log(`Encryption key already adopted at ${keyFilePath}`))
  }

  const writeError = writeKeyFile(keyFilePath, envKey)
  if (writeError !== undefined) return failWith(writeError)

  return Effect.runSync(
    Effect.gen(function* () {
      yield* Console.log(`Encryption key adopted — written to ${keyFilePath} (mode 0600)`)
      yield* Console.error(
        '\nSOVRIUM_ENCRYPTION_KEY can now be removed from the environment; the server\n' +
          'will read the same key from this file. Back the file up: losing it makes every\n' +
          'stored connection token unreadable.'
      )
    })
  )
}

/**
 * Handle the 'secret' command - dispatch to the 'generate' / 'adopt' verbs.
 */
export const handleSecretCommand = async (subcommand?: string, scope?: string): Promise<void> => {
  if (subcommand === 'adopt') return handleAdoptCommand()

  if (subcommand !== 'generate') {
    Effect.runSync(
      Console.error(
        'Error: Unknown secret subcommand\n\nUsage:\n  sovrium secret generate [auth|encryption|all]   Print fresh secret(s) as .env lines\n  sovrium secret adopt                            Persist $SOVRIUM_ENCRYPTION_KEY to the data dir'
      )
    )
    // eslint-disable-next-line functional/no-expression-statements -- CLI error exit
    process.exit(1)
  }

  const secrets = resolveScope(scope)

  if (secrets === undefined) {
    Effect.runSync(
      Console.error(
        `Error: Unknown secret scope "${scope ?? ''}".\n\nValid scopes: auth, encryption, all (default).`
      )
    )
    // eslint-disable-next-line functional/no-expression-statements -- CLI error exit
    process.exit(1)
  }

  // Print as paste-ready .env lines; the trailing hint goes to stderr so it
  // never contaminates a `sovrium secret generate auth >> .env` redirect.
  const envLines = secrets.map((secret) => `${secret.envVar}=${secret.value}`).join('\n')
  Effect.runSync(
    Effect.gen(function* () {
      yield* Console.log(envLines)
      yield* Console.error(
        '\nThese secrets are not stored — copy them into your .env or deployment environment now.'
      )
    })
  )
}
