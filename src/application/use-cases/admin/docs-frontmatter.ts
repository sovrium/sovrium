/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The frontmatter block of one exported docs article: the six keys a docs zone
 * reads, each quoted only when it has to be, or the refusal when a value cannot
 * be emitted safely. Read by the site export (`docs-site-export.ts`).
 */

import { refused, rendered } from './docs-rendering'
import type { Rendering } from './docs-rendering'

/**
 * The six keys a docs zone reads, in the order the corpus already uses.
 *
 * Grouped by `section`, sorted by `order`, labelled from `sidebarLabel`, and
 * `title`/`description`/`keywords` for SEO. A seventh key would be dead weight;
 * a missing one is a silently unlabelled sidebar entry.
 */
export interface Frontmatter {
  readonly title: string
  readonly description: string
  readonly keywords: string
  readonly section: string
  readonly order: number
  readonly sidebarLabel: string
}

/**
 * Whether a plain YAML scalar would be misread, by YAML or by Sovrium's own
 * splitter.
 *
 * Two readers, two different rules, and the emitter has to satisfy both.
 * `splitFrontmatter` splits on the FIRST colon and strips one leading and one
 * trailing quote character, so it tolerates `a: b: c`; strict YAML does not,
 * and the published tree is also read by GitHub. So the stricter rule wins.
 */
const needsQuoting = (value: string): boolean =>
  value === '' ||
  value !== value.trim() ||
  /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) ||
  /:(\s|$)/.test(value) ||
  /\s#/.test(value)

/**
 * One frontmatter value, quoted only when it has to be.
 *
 * REFUSES rather than escaping. `splitFrontmatter` strips the outer quote pair
 * and performs no unescaping at all, so a `''` or a `\"` inside a quoted value
 * would survive into the parsed string and reach the page title. A value that
 * needs quoting and contains both quote characters cannot be emitted safely by
 * either strategy — and a mangled `<title>` is worse than a failed build a
 * human can fix in the annotation it came from.
 */
export const yamlScalar = (key: string, value: string): Rendering<string, Error> => {
  if (!needsQuoting(value)) return rendered(`${key}: ${value}`)
  if (!value.includes("'")) return rendered(`${key}: '${value}'`)
  if (!value.includes('"') && !value.includes('\\')) return rendered(`${key}: "${value}"`)
  return refused(
    new Error(
      `Cannot emit frontmatter "${key}" safely: the value needs quoting and contains both quote ` +
        `characters.\n  Value: ${value}\n  Reword the manifest entry — the frontmatter parser ` +
        'strips the outer quotes without unescaping, so no escaping strategy survives it.'
    )
  )
}

/** The frontmatter block, fences included, ending in a blank line. */
export const renderFrontmatter = (front: Frontmatter): Rendering<string, Error> => {
  const lines = [
    yamlScalar('title', front.title),
    yamlScalar('description', front.description),
    yamlScalar('keywords', front.keywords),
    yamlScalar('section', front.section),
    rendered(`order: ${front.order}`),
    yamlScalar('sidebarLabel', front.sidebarLabel),
  ].reduce<Rendering<readonly string[], Error>>(
    (accumulator, line) =>
      !accumulator.ok ? accumulator : line.ok ? rendered([...accumulator.value, line.value]) : line,
    rendered([])
  )
  return lines.ok ? rendered(['---', ...lines.value, '---', '', ''].join('\n')) : lines
}
