/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Content Parsing - Pure Functions
 *
 * Domain layer utilities for parsing schema content.
 * These are pure functions with no side effects.
 */

import { assertConfigIsTree } from '../../kernel/config-parsing/shared-reference-guard'
import type { SchemaFormat } from '../../kernel/config-parsing/format-detection'
import type { AppEncoded } from '@/domain/models/app'

/**
 * Run the parsed value through the shared-reference guard before handing it on.
 *
 * This is the seam where "a config is a tree" is a TRUE invariant — text has no
 * way to express sharing except a YAML anchor — which is why the guard lives
 * here and not at the decoder, where TypeScript configs (which legitimately
 * share a hoisted `const`) also arrive. See `shared-reference-guard.ts`.
 */
const asTree = (parsed: unknown): AppEncoded => {
  assertConfigIsTree(parsed)
  return parsed as AppEncoded
}

/**
 * Parse JSON content to AppEncoded
 *
 * `JSON.parse` has no sharing construct, so the guard can never fire here; it is
 * applied anyway so the tree invariant is asserted at the seam rather than
 * assumed from the parser's behaviour.
 */
export const parseJsonContent = (content: string): AppEncoded => asTree(JSON.parse(content))

/**
 * Parse YAML content to AppEncoded
 *
 * Uses Bun's native YAML parser (`Bun.YAML.parse`). On malformed YAML this
 * throws a plain `SyntaxError` (not js-yaml's typed `YAMLException`); on a
 * well-formed document that uses anchors/aliases to share a node it throws the
 * shared-reference refusal.
 */
export const parseYamlContent = (content: string): AppEncoded => asTree(Bun.YAML.parse(content))

/**
 * Parse schema content based on detected format
 * Falls back to trying JSON first, then YAML if format is undefined
 */
export const parseSchemaContent = (
  content: string,
  format: SchemaFormat | undefined
): AppEncoded => {
  if (format === 'json') {
    return parseJsonContent(content)
  }
  if (format === 'yaml') {
    return parseYamlContent(content)
  }
  // Last fallback: try JSON first, then YAML
  try {
    return parseJsonContent(content)
  } catch {
    return parseYamlContent(content)
  }
}
