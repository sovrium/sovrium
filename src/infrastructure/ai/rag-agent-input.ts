/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface RagKnowledgeTable {
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter?: Readonly<Record<string, unknown>>
}

export interface RagAgent {
  readonly name: string
  readonly knowledge?: {
    readonly tables?: ReadonlyArray<RagKnowledgeTable>
  }
}
