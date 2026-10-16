/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One `$frontmatter.<key>` reference: the key is a name, optionally joined by
 * single hyphens (`sidebar-label`), so the punctuation an author writes after
 * it (`$frontmatter.title · Docs`) is never read as part of the key.
 */
const FRONTMATTER_REFERENCE = /\$frontmatter\.([A-Za-z_]\w*(?:-\w+)*)/g

/**
 * Substitute every `$frontmatter.<key>` reference in `value` with the rendered
 * markdown's frontmatter scalar.
 *
 * A reference may stand alone (`$frontmatter.description`) or sit inside a
 * longer value (`$frontmatter.title · Docs`). A key the file does not declare
 * resolves to the empty string, so the literal token never reaches the page;
 * without frontmatter at all, every reference resolves to the empty string.
 */
export function resolveFrontmatterReferences(
  value: string,
  frontmatter: Readonly<Record<string, string>> | undefined
): string {
  return value.replace(FRONTMATTER_REFERENCE, (_token, key: string) => frontmatter?.[key] ?? '')
}
