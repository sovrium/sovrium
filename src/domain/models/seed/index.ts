/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Seed-file domain models.
 *
 * The `sovrium seed` CLI command reads a folder of `seed/<table>.yaml` files
 * and writes their rows through the same application use-cases the records API
 * uses. Everything in this directory is pure: file format, reference and
 * template token grammars, and dependency ordering. Nothing here touches a
 * database, a filesystem, or a clock — the anchor instant for relative dates is
 * passed in, so one `sovrium seed` run renders one consistent "today".
 */

export {
  SEED_MODES,
  SeedModeSchema,
  DEFAULT_SEED_MODE,
  parseSeedMode,
  SeedRecordSchema,
  SeedFileSchema,
  resolveSeedTableName,
  findDuplicateKeys,
  type SeedMode,
  type SeedFile,
} from './seed-file'

export {
  SEED_KEY_PATTERN,
  parseSeedReference,
  parseAssetReference,
  looksLikeReference,
  classifyReferenceToken,
  type SeedReference,
  type ReferenceToken,
} from './references'

export {
  parseRelativeDateToken,
  looksLikeToken,
  expandRelativeDate,
  expandSeedStringValue,
  type RelativeDateToken,
  type RelativeDateAnchor,
  type RelativeDateUnit,
  type ExpandOutcome,
} from './relative-date'

export {
  collectSeedTableEdges,
  resolveSeedTableOrder,
  type LinkAwareField,
  type LinkAwareTable,
  type SeedTableEdge,
  type SeedTableOrder,
} from './table-order'
