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
 * It cannot live in `migrate.ts`, which imports `migration-folder.ts` — so
 * `resolveMigrationsFolder` could not say what it fails WITH without creating
 * an import cycle. Neither side owns the other; the error belongs to the area,
 * so it sits beside them both.
 *
 * `migrate.ts` re-exports it, so importers of `migrate.ts` can name it too.
 */

// Declared with the `DatabaseMigrator` port; re-exported here because this is
// where the migrator's own modules look for it.
export { MigrationError } from '@/application/ports/services/database-migrator'
