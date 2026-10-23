/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows a design-system specimen is drawn from instead of the synthetic
 * sample: a seed folder the author named, already read and resolved (no
 * database is opened). A table it holds no rows for keeps the sample.
 */
export interface SpecimenSeed {
  /** Each seeded table's rows, in file order, each with its `id`. */
  readonly tables: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>
  /** The seeded account the page is drawn as; absent, the sample administrator. */
  readonly viewer?: {
    readonly id: string
    readonly name: string
    readonly email: string
    readonly role: string
  }
}
