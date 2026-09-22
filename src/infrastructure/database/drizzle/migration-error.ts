/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The migration failure type, in its own module so that BOTH ends of the
 * migration path can name it.
 *
 * It used to live in `migrate.ts`, which imports `migration-folder.ts` — so
 * when `resolveMigrationsFolder` stopped claiming it could not fail, it had no
 * way to say what it failed WITH without creating an import cycle. Neither side
 * owns the other; the error belongs to the area, so it sits beside them both.
 *
 * `migrate.ts` re-exports it, so every existing importer is unaffected.
 */

import { Data } from 'effect'

/** Error when migration fails */
export class MigrationError extends Data.TaggedError('MigrationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}
