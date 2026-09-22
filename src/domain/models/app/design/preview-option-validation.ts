/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `preview.subject.option` — refused at boot when the subject's type publishes
 * no option under that path.
 *
 * ─── THE HALF THE TYPE CHECK LEAVES OPEN ───────────────────────────────────
 *
 * `design-console-component-validation.ts` already refuses a subject whose TYPE
 * is uncatalogued, and refuses `form` by name because a preview
 * is a preview frame ([internal ref] A3 clause 2). It says nothing about the option
 * path, and the two are not independent: the path is written onto the drawn
 * node, so `{ type: 'badge', option: 'type', value: 'form' }` passes the check
 * that refuses `form` and then rewrites the drawn node's `type` to `form` after
 * that check has run. Met by name, defeated by path.
 *
 * The plain case is the same defect without the escalation: an option nobody
 * publishes is written verbatim onto the specimen, the renderer drops it, and
 * every preview of that option draws the untouched default under a caption
 * promising something else. A picture of the default, labelled as a picture of
 * the option, is worse than no picture.
 *
 * ─── WHY IT IS NOT IN `AppSchema`'S OWN FILTER, BESIDE THE TYPE CHECK ──────
 *
 * The option universe comes from {@link schemaOptionTree}, a domain SERVICE
 * that introspects the component schemas' AST. `src/domain/models/app/**` may
 * not import a service — the layer boundary that stops a schema module from
 * depending on machinery built over it — so the rule lives here and is run
 * from the post-decode semantic pass in `decode-app-config.ts`, the one place
 * every entry point (`validate`, `start`, `build`) already shares.
 *
 * That ordering is load-bearing in the reader's favour: the decode runs first,
 * so a subject naming an uncatalogued or refused type is answered by the type
 * rule and never reaches this one. Two messages about one line would leave an
 * author guessing which to act on.
 *
 * ─── AND WHY IT DEFERS THREE TIMES ─────────────────────────────────────────
 *
 * A `$param.` or `$record.` value in either half is a URL segment or a row
 * fact, not a config fact — the same three-way deferral the subject rule takes,
 * for the reason recorded there. And a type outside the catalogue is skipped
 * rather than reported, both because the type rule owns that sentence and
 * because {@link schemaOptionTree}'s cache is bounded BY the catalogue: its own
 * docstring names the caller's guard as load-bearing, and a second caller owes
 * it.
 *
 * Specs: [internal ref]
 */

import {
  CATALOG_COMPONENT_CATEGORIES,
  catalogedTypesOf,
} from '@/domain/models/app/pages/components/component-types/catalog'
import { parseRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import { isRecordFieldRef } from '@/domain/models/app/pages/substitute-record-vars'
import { schemaOptionTree } from './schema-option-tree'

/** How many published paths a refusal lists before trailing off. */
const SUGGESTION_LIMIT = 12

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Is this string a claim the catalogue can answer today?
 *
 * `false` for a deferred form. Both halves of a subject take them: the type may
 * be `$param.type` under a routed console page, and the option may be
 * `$record.path` inside a row template over the option envelope.
 */
const isResolvableNow = (value: string): boolean =>
  !isRecordFieldRef(value) && parseRouteParamRef(value) === undefined

/** Every type the catalogue publishes, derived rather than restated. */
const catalogedTypes = (): ReadonlySet<string> =>
  new Set(CATALOG_COMPONENT_CATEGORIES.flatMap((category) => catalogedTypesOf(category)))

/** One `preview`'s declared subject, reduced to the two strings this rule reads. */
interface PreviewSubject {
  readonly type: string
  readonly option: string
}

/**
 * Recursively collect every `preview`'s `(subject.type, subject.option)` pair.
 *
 * Loose-typed and recursing through every value, so it finds a preview wherever
 * it is nested — a page's `components[]`, a container's `children[]`, a row
 * template, or inside the component a `specimen` draws.
 */
const collectPreviewSubjects = (node: unknown): readonly PreviewSubject[] => {
  if (Array.isArray(node)) return node.flatMap(collectPreviewSubjects)
  if (!isRecord(node)) return []

  const nested = Object.values(node).flatMap(collectPreviewSubjects)
  if (node['type'] !== 'preview') return nested

  const { subject } = node
  if (!isRecord(subject)) return nested
  const { type, option } = subject
  return typeof type === 'string' && typeof option === 'string'
    ? [{ type, option }, ...nested]
    : nested
}

/**
 * Does the type publish this option path?
 *
 * An exact match against the published rows is the whole test while the walk is
 * complete, which it is for every catalogued type today. `capped` is the walk's
 * own admission that it stopped short of a type's real depth, and the row it
 * stopped ON is published — so a path BELOW a published row is accepted there
 * rather than refused for being deeper than the walk went. Refusing a real
 * option because an introspection limit could not see it would be the same
 * confident-wrong answer this rule exists to prevent, pointed at the author.
 */
const publishesOption = (type: string, option: string): boolean => {
  const { items, capped } = schemaOptionTree(type)
  if (items.some((row) => row.path === option)) return true
  return capped && items.some((row) => option.startsWith(`${row.path}.`))
}

/** What the type DOES publish, for an author who has to pick again. */
const publishedPaths = (type: string): string => {
  const paths = schemaOptionTree(type).items.map((row) => row.path)
  if (paths.length === 0) return 'it publishes no options at all'
  const shown = paths.slice(0, SUGGESTION_LIMIT).join(', ')
  return paths.length > SUGGESTION_LIMIT
    ? `it publishes ${shown}, and ${paths.length - SUGGESTION_LIMIT} more`
    : `it publishes ${shown}`
}

/** Validate ONE subject; returns an error message, or `undefined`. */
const validatePreviewSubject = (
  { type, option }: PreviewSubject,
  cataloged: ReadonlySet<string>
): string | undefined => {
  if (!isResolvableNow(type) || !isResolvableNow(option)) return undefined
  if (!cataloged.has(type)) return undefined
  if (publishesOption(type, option)) return undefined

  return (
    `A preview names option "${option}" on subject type "${type}", which publishes no option ` +
    `under that path — ${publishedPaths(type)}. The value would be written onto the specimen ` +
    `verbatim and dropped by the renderer, so the frame would draw the untouched default under ` +
    `a caption promising the option.`
  )
}

/**
 * Every unpublished preview option path in one config.
 *
 * Returns the messages rather than the first, so a config with several is fixed
 * in one pass — the shape the post-decode pass in `decode-app-config.ts`
 * collects.
 */
export const validatePreviewOptionPaths = (app: unknown): readonly string[] => {
  if (!isRecord(app)) return []
  const subjects = collectPreviewSubjects(app['pages'])
  if (subjects.length === 0) return []

  const cataloged = catalogedTypes()
  return subjects
    .map((subject) => validatePreviewSubject(subject, cataloged))
    .filter((error): error is string => error !== undefined)
}
