/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// ---------------------------------------------------------------------------
// 16. `page.params` — a route segment constrained to a declared set
// ---------------------------------------------------------------------------

/**
 * The decode rules `page.params` needs and its field schema cannot carry.
 *
 * Its own module rather than a fifth family bolted onto
 * `page-binding-validation.ts`, for the reason `sidebar-nav-validation.ts`
 * records: that file is at its `max-lines` cap, and a rule family that has to be
 * squeezed in is a rule family nobody adds the next case to.
 *
 * All four refusals below are ABSENCE-shaped or IMPOSSIBILITY-shaped, so each is
 * a boot error naming the offender rather than a silent no-op — which is the
 * whole reason this key is validated outside the schema at all: an entry whose
 * key Effect 4 dropped, or an envelope key that resolves to nothing, produces a
 * page that serves every segment while its author believes it serves eleven.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Route-parameter names, by the same grammar the route matcher captures and the
 * `$param.` reader accepts. A single STATIC literal
 * (`sovrium/no-dynamic-regexp`); it must stay identical to `PARAM_REFERENCE`'s
 * capture in `page-binding-validation.ts`, or a name one half accepts is a name
 * the other half cannot resolve.
 */
const PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Envelope keys a route constraint may not use, each with the reason it cannot
 * mean anything HERE rather than a blanket "unsupported".
 *
 * All three are legitimate on a component's own `dataSource.system`; what makes
 * them impossible here is WHEN this source is read — before the route is known
 * to exist, and outside any component tree.
 */
const REFUSED_ENVELOPE_KEYS: Readonly<Record<string, string>> = {
  param:
    'substitutes another route parameter into the endpoint, so the set that decides whether a segment is real would itself be chosen by a segment nobody has vouched for yet — an ordering dependency between parameters that nothing needs today and that stays additive to allow later',
  bindTo:
    'merges a sibling filter control’s current selection into the request, and there is no page yet to carry a control when this read runs',
  sharedFilter:
    'is the companion to `bindTo`, and is inert without it — see the reason given for `bindTo`',
}

/**
 * Every violation `page.params` can carry.
 *
 * @param page the page node, already known to be a record
 * @param declared the `:segment` names this page's `path` declares
 * @param label the page's name, for the message
 */
export function routeParamAllowListViolations(
  page: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>,
  label: string
): readonly string[] {
  const { params } = page
  if (!isRecord(params)) return []

  return Object.entries(params).flatMap(([name, prop]) => [
    ...nameViolations(name, declared, label),
    ...envelopeViolations(name, prop, label),
  ])
}

/**
 * The name must be a legal parameter name AND name a segment of this page's own
 * path.
 *
 * The second half is the one that matters: a constraint on a parameter the path
 * does not declare is inert, and inert is exactly the failure mode this key
 * exists to prevent. It mirrors `systemParamViolation`, which refuses the same
 * mistake from the other direction — an endpoint naming a segment the path
 * lacks.
 */
function nameViolations(
  name: string,
  declared: ReadonlySet<string>,
  label: string
): readonly string[] {
  if (!PARAM_NAME.test(name)) {
    return [
      `${label} declares a route-parameter constraint named "${name}", which is not a legal parameter name (${PARAM_NAME.source}) — no ":${name}" can appear in a path, so the constraint could never be read`,
    ]
  }
  if (!declared.has(name)) {
    return [
      `${label} constrains route parameter "${name}", which its own path does not declare — add ":${name}" to the path, or drop the constraint. A constraint on a parameter that never matches is inert, and an inert allow-list leaves every segment served`,
    ]
  }
  return []
}

/** The three envelope keys a route constraint cannot use. */
function envelopeViolations(name: string, prop: unknown, label: string): readonly string[] {
  if (!isRecord(prop)) return []
  const { system } = prop
  if (!isRecord(system)) return []

  return Object.entries(REFUSED_ENVELOPE_KEYS).flatMap(([key, reason]) =>
    system[key] === undefined
      ? []
      : [
          `${label} declares \`params.${name}.system.${key}\`, which a route constraint may not use: it ${reason}.`,
        ]
  )
}
