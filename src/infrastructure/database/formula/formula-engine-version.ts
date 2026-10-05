/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The version of the formula engine this binary ships — how a formula is
 * translated to SQL and when its values are computed.
 *
 * Stored as `formula_engine_version` on the schema checksum's singleton row
 * each time a migration completes. The checksum hashes the CONFIG alone, so a
 * binary that computes formulas differently (or a previous one that never
 * filled a formula for the rows already there) would otherwise leave stale
 * values on every deployment whose config did not move. A boot that finds the
 * stored version older declines the checksum fast path and recomputes every
 * trigger-computed formula once, then stores this value.
 *
 * Raise it by one whenever a change makes the values an earlier binary stored
 * wrong. `0` — what the column's migration leaves — is older than any binary.
 */
export const FORMULA_ENGINE_VERSION = 1
