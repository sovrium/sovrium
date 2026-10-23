/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** An action as this rule reads it: loose enough to walk any action of any family. */
interface LooseAction {
  readonly name?: unknown
  readonly type?: unknown
  readonly props?: unknown
}

/** The props of an action, as an object, or none. */
const propsOf = (action: LooseAction): Readonly<Record<string, unknown>> =>
  typeof action.props === 'object' && action.props !== null
    ? (action.props as Readonly<Record<string, unknown>>)
    : {}

/** An array of actions, or none. */
const actionsIn = (value: unknown): readonly LooseAction[] =>
  Array.isArray(value) ? (value as readonly LooseAction[]) : []

/**
 * Every action of a list, the ones nested in a loop's `actions` and a path's
 * `paths[].actions` included.
 */
const everyAction = (actions: readonly LooseAction[]): readonly LooseAction[] =>
  actions.flatMap((action) => {
    const props = propsOf(action)
    const paths = actionsIn(props['paths']).flatMap((path) =>
      actionsIn(propsOf({ props: path })['actions'])
    )
    return [action, ...everyAction([...actionsIn(props['actions']), ...paths])]
  })

/**
 * Every `notification` step names a kind the app declares under
 * `notifications.kinds`: a kind it does not declare would write notifications
 * nobody may turn off and no preference names. The message names the kind and
 * the declared ones.
 */
export const validateNotificationKinds = (app: {
  readonly notifications?: { readonly kinds: readonly { readonly name: string }[] }
  readonly automations?: readonly {
    readonly name: string
    readonly actions: readonly unknown[]
  }[]
}): true | string => {
  const declared = (app.notifications?.kinds ?? []).map((kind) => kind.name)
  const refused = (app.automations ?? [])
    .flatMap((automation) =>
      everyAction(automation.actions as readonly LooseAction[]).map((action) => ({
        automation: automation.name,
        action,
      }))
    )
    .find(({ action }) => {
      const { kind } = propsOf(action)
      return action.type === 'notification' && typeof kind === 'string' && !declared.includes(kind)
    })
  if (refused === undefined) return true
  const kind = String(propsOf(refused.action)['kind'])
  const known =
    declared.length === 0 ? 'none — the app has no notifications key' : declared.join(', ')
  return `Automation '${refused.automation}' notification action '${String(refused.action.name)}' sends the kind '${kind}', which notifications.kinds does not declare (declared: ${known})`
}
