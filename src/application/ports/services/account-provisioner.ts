/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Account creation through the auth engine, as the bootstrap use-cases see it.
 *
 * Creating an account is not a row insert: the auth engine hashes the
 * password, writes the credential account beside the user and applies its
 * own hooks. So the use-cases that seed the first admin ask the engine through
 * this port rather than holding the engine itself.
 */

import { Context, Data, type Effect } from 'effect'
import type { Auth } from '@/domain/models/app/auth'

/** The auth engine refused the account or could not be reached. `cause` is its own error. */
export class AccountCreationError extends Data.TaggedError('AccountCreationError')<{
  readonly cause: unknown
}> {}

export interface NewAccount {
  readonly email: string
  readonly password: string
  readonly name: string
  /**
   * Any role the app declares. The engine's admin plugin accepts app-defined
   * roles (`operator`, `engineer`, …), not only its built-in pair.
   */
  readonly role: string
}

export class AccountProvisioner extends Context.Service<
  AccountProvisioner,
  {
    /**
     * Create one account and answer the new user's id — `undefined` when the
     * engine answered without one. An account that already exists fails with
     * {@link AccountCreationError}, whose cause carries the engine's message.
     */
    readonly createUser: (
      account: Readonly<NewAccount>
    ) => Effect.Effect<{ readonly userId: string | undefined }, AccountCreationError>
  }
>()('AccountProvisioner') {}

/**
 * Account creation for code that holds an app's auth CONFIG rather than a
 * running engine — the `auth/createUser` automation step, which is reachable
 * from the cron scheduler and the record-event dispatcher as well as from a
 * request. The implementation builds the engine from the config on demand, so
 * a deployment without an `auth:` block never loads it.
 */
export class ConfigAccountProvisioner extends Context.Service<
  ConfigAccountProvisioner,
  {
    /** Create one account; `role` absent leaves the engine's default role. */
    readonly createUser: (
      authConfig: Auth | undefined,
      account: Readonly<Omit<NewAccount, 'role'> & { readonly role?: string | undefined }>
    ) => Effect.Effect<{ readonly userId: string | undefined }, AccountCreationError>
  }
>()('ConfigAccountProvisioner') {}
