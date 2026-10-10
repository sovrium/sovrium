/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Automation group-operator cross-validation.
 *
 * An `auth/addToGroup` or `auth/removeFromGroup` step names its group by NAME.
 * When that name is written literally, a typo would otherwise surface only when
 * the step first runs — on the first real member, long after deploy — so a
 * literal name the config does not declare in `auth.groups` is refused when the
 * app is validated. A name carrying a `{{…}}` template is only known at run
 * time, so it is checked there instead (the step fails and changes nothing).
 *
 * Reads the automations structurally, so this module depends on no other
 * property's schema; it is reached from the app-wide refinement in `app.ts`.
 */

/** The operators whose `group` prop names a declared group. */
const GROUP_OPERATORS: ReadonlySet<string> = new Set(['addToGroup', 'removeFromGroup'])

/** Minimal shape needed to validate the group operators' literal names. */
interface AppForGroupActionValidation {
  readonly auth?: { readonly groups?: ReadonlyArray<{ readonly name: string }> }
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly actions?: ReadonlyArray<unknown>
  }>
}

/** One step, read without trusting its shape. */
type LooseAction = Readonly<Record<string, unknown>>

const asActions = (value: unknown): readonly LooseAction[] =>
  Array.isArray(value)
    ? (value.filter((item) => item !== null && typeof item === 'object') as LooseAction[])
    : []

const propsOf = (action: LooseAction): Readonly<Record<string, unknown>> => {
  const { props } = action
  return props !== null && typeof props === 'object'
    ? (props as Readonly<Record<string, unknown>>)
    : {}
}

/**
 * Every step of an automation, nested ones included: a loop's `actions`, a
 * path's branches, and the `actions` a step may carry beside its props.
 */
const flattenSteps = (actions: readonly LooseAction[]): readonly LooseAction[] =>
  actions.flatMap((action) => {
    const props = propsOf(action)
    const branches = asActions(props['paths']).flatMap((path) => asActions(path['actions']))
    return [
      action,
      ...flattenSteps(asActions(action['actions'])),
      ...flattenSteps(asActions(props['actions'])),
      ...flattenSteps(branches),
    ]
  })

/** The literal group a group-operator step names, or `undefined` when it names none. */
const literalGroupOf = (action: LooseAction): string | undefined => {
  if (action['type'] !== 'auth' || !GROUP_OPERATORS.has(String(action['operator']))) {
    return undefined
  }
  const { group } = propsOf(action)
  return typeof group === 'string' && !group.includes('{{') ? group.trim() : undefined
}

/**
 * Validate that every LITERAL `group` an `auth/addToGroup` or
 * `auth/removeFromGroup` step names is declared in `app.auth.groups`.
 *
 * Returns `true` when every literal name is declared, or an error naming the
 * first automation, step and group that is not.
 */
export const validateAllGroupActionReferences = (
  app: AppForGroupActionValidation
): string | true => {
  const declared = new Set(app.auth?.groups?.map((group) => group.name) ?? [])
  const error = (app.automations ?? [])
    .flatMap((automation) =>
      flattenSteps(asActions(automation.actions)).flatMap((action) => {
        const group = literalGroupOf(action)
        return group === undefined || declared.has(group)
          ? []
          : [
              `Automation '${automation.name}' step '${String(action['name'] ?? '?')}' ` +
                `(auth/${String(action['operator'])}) names undefined group '${group}'. ` +
                `Declare it in auth.groups.`,
            ]
      })
    )
    .at(0)
  return error ?? true
}
