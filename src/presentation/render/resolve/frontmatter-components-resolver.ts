/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveFrontmatterReferences } from '@/domain/models/app/pages/frontmatter-reference-service'
import { substituteTemplatesDeep, type ValueEncoder } from './html-template-values'

/** The front matter with each value written as `encode` writes a value into its template. */
const encodedFrontmatter = (
  frontmatter: Readonly<Record<string, string>>,
  encode: ValueEncoder | undefined
): Readonly<Record<string, string>> =>
  encode === undefined
    ? frontmatter
    : Object.fromEntries(Object.entries(frontmatter).map(([key, value]) => [key, encode(value)]))

/**
 * Fill the article's front matter into the components of the page that
 * publishes it: every `frontmatter.<key>` reference in a component's content,
 * props or a placed template's `vars`, as `meta` resolves it. A key the
 * article does not declare resolves to nothing, so the token never reaches the
 * page.
 *
 * Through `substituteTemplatesDeep`, the rule every `$`-reference pass shares:
 * a value filled into an HTML template is escaped, and a text template a value
 * would turn into markup is pinned to text.
 */
export const resolveFrontmatterInComponents = <T>(
  components: T,
  frontmatter: Readonly<Record<string, string>>
): T =>
  substituteTemplatesDeep(components, (str, encode) =>
    str.includes('frontmatter.')
      ? resolveFrontmatterReferences(str, encodedFrontmatter(frontmatter, encode))
      : str
  ) as T
