/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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

/** A `{{…}}` expression, as the template engine reads one. */
const MUSTACHE = /\{\{[\s\S]*?\}\}/g

/** A known `$name` → the reference an inline template reads it by (`{{$vars.name}}`). */
const referenceVarsInString = (input: string, vars: Readonly<Record<string, unknown>>): string => {
  const known = (name: string): boolean => Object.prototype.hasOwnProperty.call(vars, name)
  const expressions = input.match(MUSTACHE) ?? []
  return input
    .split(MUSTACHE)
    .map((text, index) => {
      const outside = text.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string) =>
        known(name) ? `{{$vars.${name}}}` : match
      )
      const expression = expressions[index]
      return expression === undefined
        ? outside
        : outside +
            expression.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string) =>
              known(name) && name !== 'vars' && name !== 'env' ? `$vars.${name}` : match
            )
    })
    .join('')
}

/**
 * `$varName` substitution over a template's action body for the run loop. An
 * inline template's text (`{ inline }` — rendered by its handler against
 * `data`, never by the generic pass) keeps each `$name` as a `{{$vars.name}}`
 * reference instead, read from the step's variables once the run resolved
 * them; every other string gets the value as text, as before.
 */
const substituteForRun = (value: unknown, vars: Readonly<Record<string, unknown>>): unknown => {
  if (typeof value === 'string') return substituteVarsInString(value, vars)
  if (Array.isArray(value)) return value.map((item) => substituteForRun(item, vars))
  if (value === null || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>)
  return Object.fromEntries(
    entries.map(([key, child]) => [
      key,
      key === 'inline' && typeof child === 'string'
        ? referenceVarsInString(child, vars)
        : substituteForRun(child, vars),
    ])
  )
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
  const merged = { ...(template.variables ?? {}), ...(overrides ?? {}) }
  const expanded = substituteForRun(template.action, merged) as Record<string, unknown>

  // Preserve the caller-supplied step name so run-history references the
  // automation's perspective ("sendNotify"), not the template's
  // ("notify"). The merged variables ride along as `$vars`: the step resolves
  // them against the run for the references an inline template kept.
  return { ...expanded, name: rawAction['name'] ?? expanded['name'], $vars: merged }
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
