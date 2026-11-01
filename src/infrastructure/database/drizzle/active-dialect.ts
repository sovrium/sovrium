/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/**
 * The dialect the RUNNING `Database` layer resolved when it was acquired.
 *
 * A leaf on purpose: the module-level table selectors, which cannot be handed a
 * dialect, answer from here
 * while a layer is alive, so the engine is decided once per server rather than
 * re-derived from the environment on every call. They import this module and
 * nothing heavier, which keeps them free of a cycle through the client module.
 *
 * `undefined` means no layer is alive — the boot phase before the server's
 * runtime exists, a CLI verb, a unit test — and those readers fall back to the
 * environment, exactly as they did before a layer carried the dialect.
 */
const active = new Map<'dialect', DatabaseDialect>()

/** The dialect the running layer acquired, or `undefined` when none is alive. */
export const activeDialectKind = (): DatabaseDialect | undefined => active.get('dialect')

/** Publish the dialect a layer acquired, or clear it (`undefined`) when the last one releases. */
export const setActiveDialectKind = (kind: DatabaseDialect | undefined): void => {
  if (kind === undefined) active.delete('dialect')
  else active.set('dialect', kind)
}
