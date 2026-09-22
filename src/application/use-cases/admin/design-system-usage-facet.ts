/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a component type — or a named template — is already written.
 *
 * Its own module because `design-system-facets.ts` crossed the 400-line cap,
 * and this is the cleanest seam in it: every other facet there projects the
 * DESIGN (tokens, sentences, coverage, exports), while this one walks the
 * PAGES asking where a subject appears. Different input, different question.
 *
 * @see src/domain/models/api/admin/design-system/facets.ts
 */

import { isHeavyTemplate, templateSnippet } from '@/domain/models/app/design/template-snippet'
import {
  CATALOG_COMPONENT_CATEGORIES,
  catalogedTypesOf,
} from '@/domain/models/app/pages/components/component-types/catalog'
import type {
  UsageResponse,
  UsageRow,
  UsageSubject,
} from '@/domain/models/api/admin/design-system/facets'
import type { App } from '@/domain/models/app'

// ---------------------------------------------------------------------------
// Where a type — or a named template — is already written
// ---------------------------------------------------------------------------

/**
 * Every subject one component tree writes, recursively.
 *
 * ─── TWO PROPERTIES, BOTH LOAD-BEARING, BOTH MEASURED ──────────────────────
 *
 * It RECURSES, because a top-level-only walk of `pages[].components[]` sees
 * three distinct catalogued types on the shipped apps where this sees
 * twenty-three — `button` among the twenty that vanish — so a flat counter
 * prints "0 routes" on the very page the reference draws, indistinguishably from
 * the types that genuinely have no usage.
 *
 * And it skips `props` WHOLE, because that bag carries native HTML attributes
 * whose values collide with type names: thirteen `props.type: 'button'` across
 * the shipped apps inflate `button` by 45% if the walk descends into it.
 *
 * A template REFERENCE is `{ component: 'site-header' }` — a string. A
 * `specimen`'s `component` field holds a component OBJECT, so the string check
 * is what keeps a drawn specimen from being counted as a reference to a template
 * that does not exist.
 */
const subjectsIn = (node: unknown, subject: UsageSubject): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap((entry) => subjectsIn(entry, subject))
  if (typeof node !== 'object' || node === null) return []

  const record = node as Readonly<Record<string, unknown>>
  const own = record[subject === 'type' ? 'type' : 'component']
  return [
    ...(typeof own === 'string' ? [own] : []),
    ...Object.entries(record).flatMap(([key, value]) =>
      key === 'props' ? [] : subjectsIn(value, subject)
    ),
  ]
}

/** The subjects a usage read answers for, in the order the console draws them. */
const subjectNames = (app: App, subject: UsageSubject): readonly string[] =>
  subject === 'type'
    ? CATALOG_COMPONENT_CATEGORIES.flatMap((category) => catalogedTypesOf(category))
    : (app.components ?? []).map((component) => component.name)

/**
 * How many of the operator's routes write each subject, and which.
 *
 * A subject nobody writes is a row with `count: 0` and an empty `routes`, not an
 * absent row: the card index draws a card per catalogued type either way, and an
 * absent row would make "unused" indistinguishable from "not a type". For the
 * same reason an unknown `name` returns zero rows rather than a 404 — the
 * catalogue is what answers "does this type exist", and duplicating that
 * judgement here would give two endpoints an opportunity to disagree.
 *
 * The walk is hoisted over the whole config once rather than run per subject:
 * asking per type would re-walk a sixty-seven-page app eighty-five times for a
 * page that should pay either the catalogue or the config, never their product.
 */
export const usageFacet = (app: App, subject: UsageSubject, name?: string): UsageResponse => {
  const perRoute = (app.pages ?? []).map((page) => ({
    path: page.path,
    subjects: new Set(subjectsIn(page.components, subject)),
  }))

  // Only a `component` subject has a template behind it, so only that arm can
  // be serialised or weighed. A `type` row answers `heavy: false` and carries no
  // snippet: a component TYPE is the engine's, not the operator's, so there is
  // nothing of theirs to copy and nothing of theirs to be too tall.
  const templates = new Map((app.components ?? []).map((entry) => [entry.name, entry] as const))

  const rows: readonly UsageRow[] = subjectNames(app, subject)
    .filter((candidate) => name === undefined || candidate === name)
    .map((candidate) => {
      const routes = perRoute.flatMap((entry) =>
        entry.subjects.has(candidate) ? [entry.path] : []
      )
      const template = subject === 'component' ? templates.get(candidate) : undefined
      return {
        subject,
        name: candidate,
        count: routes.length,
        routes,
        heavy: template !== undefined && isHeavyTemplate(template),
        ...(template === undefined ? {} : { snippet: templateSnippet(template) }),
      }
    })

  // The row-shaped copy of every `routes` entry, flattened here rather than in
  // the page: `rowsKey` hands a template a RECORD and `$record.` names a field
  // of one, so the bare `string[]` above is readable by a caller and unbindable
  // by a config page. Derived from the SAME rows, so the two cannot disagree
  // about which routes exist.
  const routeRows = rows.flatMap((row) =>
    row.routes.map((route) => ({ subject: row.subject, name: row.name, route }))
  )

  return { items: rows, total: rows.length, routeRows }
}
