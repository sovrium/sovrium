/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where each source's set step holds its named values, for the `fields` of
 * its registry row (`flow-step-mappings.ts`). A leaf module: the registry
 * reads these while it is built, so they import nothing.
 */

/** Where a step that sets named values holds them. */
export interface FieldsSource {
  /** The input holding a list of `{ name, value }` pairs; absent, the inputs ARE one pair. */
  readonly list?: string
  /** The key of a pair's name. */
  readonly name: string
  /** The key of a pair's value. */
  readonly value: string
  /** The input that, unless `false`, makes a dotted name nest under its first segment. */
  readonly dotted?: string
  /** The input that, when `true`, says the step also handed on the rest of its input. */
  readonly keepsInput?: string
}

/** Make's Set variable: its inputs are one `{ name, value }`. */
export const MAKE_SET: FieldsSource = { name: 'name', value: 'value' }

/** Make's Set multiple variables: a `variables` list of `{ name, value }`. */
export const MAKE_SET_MANY: FieldsSource = { list: 'variables', name: 'name', value: 'value' }

/** n8n's Edit Fields (Set) node, as `n8n-set-node-service.ts` normalises it. */
export const N8N_SET: FieldsSource = {
  list: 'fields',
  name: 'name',
  value: 'value',
  dotted: 'dotNotation',
  keepsInput: 'includeOtherFields',
}
