/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One many-to-many field's junction rows to add or remove for a record: the
 * related table, the related ids, the field's own link table, and the link
 * table of its reciprocal field on the related table when it has one (whose
 * mirror rows move with them).
 */
export interface RecordLinkWrite {
  readonly relatedTable: string
  readonly relatedIds: readonly (string | number)[]
  readonly linkTable: string
  readonly mirrorLinkTable?: string | undefined
}

/** A many-to-many field whose links are read: its name, the table it links to, its link table. */
export interface ManyToManyFieldRead {
  readonly fieldName: string
  readonly relatedTable: string
  readonly linkTable: string
}
