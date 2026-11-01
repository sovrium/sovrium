/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The values a specimen subject declares, read literally or through a route
 * parameter: its type, its axes, the component template it names, and the
 * refusals drawn when none of them can be drawn.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { catalogSpecimenRefusal } from '@/domain/models/app/design/catalog-specimens'
import { parseRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import { synthesizedComponent } from './component-rewrite'
import type { SpecimenTemplates } from './specimen-subject-resolver'
import type { SpecimenAxes } from '@/domain/models/app/design/catalog-specimens'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Name the drawn component after the type the specimen is OF.
 *
 * A specimen has to be addressable by its SUBJECT, and the drawn root does not
 * always carry that name: the catalogue's `badge` specimen is a `container` of
 * four badges, so a reader looking for "the badge specimen" would find four
 * elements or none. `data-component` is the attribute the codebase already uses
 * for "what this element IS" (`data-component-type` reports the node's own type
 * and stays untouched), and it is a reserved pass-through prop, so stamping it
 * needs no renderer to opt in.
 *
 * Never overwritten: a renderer that already publishes its own name — the
 * `table` island mount host does — keeps it, and the stamped prop is
 * dropped by that renderer rather than emitting a second element under the same
 * name.
 */
export const nameSpecimen = (drawn: object, subject: string): Component => {
  if (!isRecord(drawn)) return synthesizedComponent(drawn)
  const props = isRecord(drawn['props']) ? drawn['props'] : {}
  if (props['data-component'] !== undefined) return synthesizedComponent(drawn)
  return synthesizedComponent({ ...drawn, props: { ...props, 'data-component': subject } })
}

/**
 * One value a subject names: the route segment it points at, or the literal.
 *
 * `$record.` never reaches here — a subject holding one is left for the ROW
 * pass, which runs after expansion has substituted it to a real value.
 */
export const declaredValueOf = (
  declared: unknown,
  routeParams: Readonly<Record<string, string>>
): string | undefined => {
  if (typeof declared !== 'string') return undefined
  const ref = parseRouteParamRef(declared)
  return ref === undefined ? declared : routeParams[ref.name]
}

/** The TEMPLATE a subject names: a route segment, or the literal itself. */
export const subjectTemplateOf = (
  subject: unknown,
  routeParams: Readonly<Record<string, string>>
): string | undefined =>
  isRecord(subject) ? declaredValueOf(subject['component'], routeParams) : undefined

/**
 * One specimen drawn from the operator's own `components[]`.
 *
 * ─── THE TEMPLATE IS SUBSTITUTED, NOT REFERENCED ───────────────────────────
 *
 * The cheaper move is to emit a reference node and let `renderComponentReference`
 * do the lookup at render time. It draws correctly and it makes the SNIPPET a
 * lie: `showSnippet` projects its block from this same `component` field, so a
 * reference serialises to `component: site-header` — a block that names the
 * template and shows none of it, offering a reader config the author never
 * wrote. Substituting the declaration itself gives one source of truth for both
 * halves, which is the whole reason `specimen` holds a literal.
 *
 * `$t:` needs nothing here. The substituted node is an ordinary part of the
 * page tree by the time the renderers run, so its lookups resolve exactly as
 * they do inside the pages that embed the template — against the rendering
 * app's own catalogue, which under the console mount is the operator's English
 * table (`dashboardSurfaceLanguages`).
 *
 * ─── AN UNKNOWN NAME NEVER 404s, IN ANY MODE ───────────────────────────────
 *
 * Unlike a subject `type`, a template name is not checked at boot: under an
 * admin mount the templates being documented belong to the OPERATOR's app,
 * which the preset cannot see at decode time, so a membership test there would
 * refuse every console page that draws one. The refusal is therefore reported
 * in place — including in `route` mode, where a catalogue miss would 404. A
 * console page listing an app's templates must not disappear because one of
 * them got a new name.
 */
export const resolveTemplateSubject = (
  node: Record<string, unknown>,
  name: string,
  templates: SpecimenTemplates
): Component => {
  const template = templates.get(name)
  if (template === undefined) return reportMissingTemplate(node, name)
  const { subject: _resolved, ...rest } = node
  return synthesizedComponent({ ...rest, component: nameSpecimen(template, name) })
}

/** A specimen naming a template this app does not declare, reporting in place. */
const reportMissingTemplate = (node: Record<string, unknown>, name: string): Component => {
  const props = isRecord(node['props']) ? node['props'] : {}
  const { subject: _unresolved, component: _undrawn, ...rest } = node
  return synthesizedComponent({
    ...rest,
    props: { ...props, 'data-design-specimen-state': 'no-renderer' },
    children: [
      {
        type: 'text',
        element: 'p',
        content: `No specimen: this app declares no components[] template named “${name}”.`,
      },
    ],
  })
}

/** The type a subject names: a route segment, or the literal itself. */
export const subjectTypeOf = (
  subject: unknown,
  routeParams: Readonly<Record<string, string>>
): string | undefined =>
  isRecord(subject) ? declaredValueOf(subject['type'], routeParams) : undefined

/** The three axis keys, in the order the schema declares them. */
export const AXIS_KEYS = ['variant', 'size', 'state'] as const

/**
 * The axis values a subject names, resolved.
 *
 * `undefined` — a refusal — when an axis IS declared and does not resolve,
 * which today means a `$param.` naming a segment the route has not got. An
 * axis that silently vanished would draw the default under a label promising
 * something else, which is the failure the whole triple exists to make visible.
 */
export const subjectAxesOf = (
  subject: unknown,
  routeParams: Readonly<Record<string, string>>
): SpecimenAxes | undefined => {
  if (!isRecord(subject)) return {}
  const resolved = AXIS_KEYS.map((key) =>
    subject[key] === undefined
      ? ([key, undefined] as const)
      : ([key, declaredValueOf(subject[key], routeParams)] as const)
  )
  return resolved.some(([key, value]) => subject[key] !== undefined && value === undefined)
    ? undefined
    : Object.fromEntries(resolved.filter(([, value]) => value !== undefined))
}

/**
 * A specimen whose resolved subject cannot be drawn, reporting itself in place.
 *
 * The state is the catalogue's OWN when it has one on file, and `no-renderer`
 * when the type is not catalogued at all — which is the closest true statement
 * rather than a fourth vocabulary invented for this branch. Nothing is drawn:
 * a frame that both reported and drew would be saying two things at once.
 */
export const reportUndrawable = (
  node: Record<string, unknown>,
  type: string | undefined
): Component => {
  const named = type ?? 'nothing'
  const refusal = type === undefined ? undefined : catalogSpecimenRefusal(type)
  const props = isRecord(node['props']) ? node['props'] : {}
  const { subject: _unresolved, component: _undrawn, ...rest } = node
  return synthesizedComponent({
    ...rest,
    props: { ...props, 'data-design-specimen-state': refusal?.state ?? 'no-renderer' },
    children: [
      {
        type: 'text',
        element: 'p',
        content: refusal?.note ?? `No specimen: “${named}” is not a catalogued component type.`,
      },
    ],
  })
}
