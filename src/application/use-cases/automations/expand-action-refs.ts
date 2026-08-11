/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from './value-walker'

/**
 * An action template as declared in `app.actions[]`. Re-typed locally as a
 * shallow read-only structure so the expansion helper does not need to
 * depend on the encoded/decoded schema types from the domain layer.
 */
export interface ActionTemplateLike {
  readonly name: string
  readonly action: Readonly<Record<string, unknown>>
  readonly variables?: Readonly<Record<string, unknown>>
}

/**
 * Substitute `$varName` placeholders in `input` against the supplied `vars`
 * map. Unknown names pass through unchanged (so a literal `$5` in the
 * template's body survives), known but null/undefined values resolve to ''.
 */
const substituteVarsInString = (input: string, vars: Readonly<Record<string, unknown>>): string =>
  input.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return match
    const replacement = vars[name]
    return replacement === undefined || replacement === null ? '' : String(replacement)
  })

/**
 * Substitute `$varName` placeholders in any string leaf of `value`. Arrays
 * and plain objects are traversed structurally via `mapStringsDeep`; other
 * scalars pass through unchanged.
 *
 * Exported so the runtime template invoker (used by code action's
 * `context.actions.ref('<name>', vars)` proxy) can reuse the same
 * substitution semantics as static `$ref` expansion.
 */
export const substituteVars = (value: unknown, vars: Readonly<Record<string, unknown>>): unknown =>
  mapStringsDeep(value, (s) => substituteVarsInString(s, vars))

/**
 * Merge a template's declared `variables` defaults with caller-supplied
 * `vars` (caller values take precedence on key collision), then apply
 * `$varName` substitution throughout the template's action body.
 *
 * Shared by the static `$ref` expansion path
 * ({@link expandRefAction}) and the runtime `context.actions.ref(...)`
 * invoker so both surfaces produce identical substitution semantics.
 * Returns the substituted action body — the caller is responsible for
 * any `name` field preservation specific to its surface (the static
 * path keeps the caller's step name; the runtime path uses the
 * template's own action name).
 */
export const applyTemplateVars = (
  template: ActionTemplateLike,
  callerVars: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> => {
  const merged = { ...(template.variables ?? {}), ...(callerVars ?? {}) }
  return substituteVars(template.action, merged) as Record<string, unknown>
}

/**
 * Resolve a single `$ref` action by looking up its template in
 * `app.actions[]` and applying any `$vars` overrides on top of the
 * template's declared `variables` defaults.
 *
 * Returns the original action unchanged if it is not a ref or if the
 * referenced template is missing — the schema-level cross-validation
 * filter in {@link AppSchema} catches missing templates at startup, so
 * here we only need a defensive fallback.
 */
export const expandRefAction = (
  rawAction: Readonly<Record<string, unknown>>,
  templates: ReadonlyArray<ActionTemplateLike>
): Readonly<Record<string, unknown>> => {
  if (rawAction['type'] !== 'ref') return rawAction

  const refName = String(rawAction['$ref'] ?? '')
  const template = templates.find((t) => t.name === refName)
  if (!template) return rawAction

  const overrides = rawAction['$vars'] as Record<string, unknown> | undefined
  const expanded = applyTemplateVars(template, overrides) as Record<string, unknown>

  // Preserve the caller-supplied step name so run-history references the
  // automation's perspective ("sendNotify"), not the template's
  // ("notify").
  return { ...expanded, name: rawAction['name'] ?? expanded['name'] }
}

/**
 * Expand every `$ref` action in an automation's action list.
 *
 * Recursive: also expands refs nested inside `path.props.paths[].actions`
 * and `loop.props.actions`, matching the recursion pattern used by the
 * cross-validation filters in `AppSchema`.
 */
export const expandRefActions = (
  actions: ReadonlyArray<Readonly<Record<string, unknown>>>,
  templates: ReadonlyArray<ActionTemplateLike>
): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  actions.map((action) => {
    if (action['type'] === 'ref') return expandRefAction(action, templates)

    if (action['type'] === 'path') {
      const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
      const paths = (props['paths'] as ReadonlyArray<Record<string, unknown>> | undefined) ?? []
      const expandedPaths = paths.map((branch) => ({
        ...branch,
        actions: expandRefActions(
          (branch['actions'] as ReadonlyArray<Record<string, unknown>>) ?? [],
          templates
        ),
      }))
      return { ...action, props: { ...props, paths: expandedPaths } }
    }

    if (action['type'] === 'loop') {
      const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
      const loopActions =
        (props['actions'] as ReadonlyArray<Record<string, unknown>> | undefined) ?? []
      return {
        ...action,
        props: {
          ...props,
          actions: expandRefActions(loopActions, templates),
        },
      }
    }

    return action
  })
