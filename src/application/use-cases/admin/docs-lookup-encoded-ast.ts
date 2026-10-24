/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SchemaAST } from 'effect'
import type { SchemaNode } from '@/domain/models/app/design/type-introspection'

/**
 * The schema as a config file WRITES it — the encoded side.
 *
 * A path is typed as the author typed it, so it is looked up on the side the
 * author writes. The decoded side differs wherever a schema transforms its
 * input: an automation's single `trigger` exists only there as input, and is a
 * one-entry `triggers` list once decoded, so a decoded-side walk refused a key
 * the article documents. `toEncoded` is memoised on the node, so the owning
 * article's schemas map to the SAME nodes the descent visited and attribution
 * by identity still holds; a subtree with no transformation keeps its node.
 */
export const asWritten =
  (astOfValue: (value: unknown) => SchemaNode | undefined) =>
  (node: SchemaNode): SchemaNode =>
    // `astOfValue` reads `.ast` off what it is given, which is how the encoded
    // AST re-enters the structural `SchemaNode` view without a cast.
    SchemaAST.isAST(node) ? (astOfValue({ ast: SchemaAST.toEncoded(node) }) ?? node) : node
