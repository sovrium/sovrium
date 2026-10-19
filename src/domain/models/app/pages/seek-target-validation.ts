/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `seek` action's `target` must name a `video` or `audio` component on its
 * page.
 *
 * `target` is the `props.id` of the player a seek moves. The schema checks it
 * is a non-empty string, not that a player on the page carries it — so a typo
 * (`cal-player`) validated and the click then moved nothing, silently, since a
 * player absent at click time is a no-op by design (it may sit in a closed
 * dialog). An id naming a component that is not a player (a `textarea`) would
 * fail the same silent way.
 *
 * What is checked, and what is left alone, is exactly the `fill` target check's
 * (`fill-target-validation.ts`): every seek written on a page, at any depth,
 * against every component id on that page, a closed dialog's children
 * included; a target built from a `$record.` / `{{ }}` token, and every seek on
 * a page that places a component template or carries an id built from a token,
 * are not checked.
 */

import { componentId, isDynamic, isPlacement, objectsUnder } from './fill-target-validation'

/** Minimal shape needed to validate seek targets. */
interface AppForSeekTargetValidation {
  readonly pages?: unknown
}

/** The component types a seek can move. */
const PLAYER_TYPES: ReadonlySet<unknown> = new Set(['video', 'audio'])

/** The `target` of a seek action, or `undefined` when `record` is not one. */
const seekTarget = (record: Readonly<Record<string, unknown>>): string | undefined =>
  record['type'] === 'seek' && typeof record['target'] === 'string' && 'time' in record
    ? record['target']
    : undefined

/** Why `target` cannot be moved, given the page's component types by id. */
const targetProblem = (
  target: string,
  typesById: ReadonlyMap<string, unknown>
): string | undefined => {
  if (!typesById.has(target)) {
    return `names no component on its page: no component there has props.id '${target}'`
  }
  const type = typesById.get(target)
  return PLAYER_TYPES.has(type) ? undefined : `names a ${String(type)}, not a video or audio player`
}

/** The refusal for one page, or `undefined` when every static target is a player there. */
const pageRefusal = (page: unknown): string | undefined => {
  const objects = objectsUnder((page as { readonly components?: unknown } | null)?.components)
  const components = objects.flatMap((record) => {
    const id = componentId(record)
    return id === undefined ? [] : [[id, record['type']] as const]
  })
  if (components.some(([id]) => isDynamic(id)) || objects.some(isPlacement)) return undefined
  const typesById = new Map(components)
  const refused = objects
    .flatMap((record) => {
      const target = seekTarget(record)
      if (target === undefined || isDynamic(target)) return []
      const problem = targetProblem(target, typesById)
      return problem === undefined ? [] : [{ target, problem }]
    })
    .at(0)
  if (refused === undefined) return undefined
  const { name } = page as { readonly name?: unknown }
  const where = typeof name === 'string' ? ` (on page '${name}')` : ''
  return (
    `seek: target '${refused.target}'${where} ${refused.problem}. ` +
    `A seek moves a video or audio component on the same page: give the player that id, or correct the target.`
  )
}

/**
 * Validate every seek written on a page against the players of that page.
 *
 * @returns `true` when every static target names a video or audio component on
 * its page, or the message naming the first one that does not.
 */
export const validateAllSeekTargets = (app: AppForSeekTargetValidation): string | true => {
  const pages = Array.isArray(app.pages) ? app.pages : []
  const refusal = pages.map(pageRefusal).find((message) => message !== undefined)
  return refusal ?? true
}
