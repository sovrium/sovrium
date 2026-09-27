/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two things an island host owes the component it stands in for.
 *
 * A generic renderer spreads the element props it is handed onto the element
 * it draws, so every component names its type (`data-component-type`) and
 * carries its author's `props.className` for free. An island host writes its
 * own `<div>` instead, and each one used to pick the attributes it forwarded
 * by hand — which is how most of them came to drop both. These two readers are
 * the one place that decides what the host forwards.
 */

/** The `data-component-type` the renderer stamped on the element props, if any. */
export const hostComponentType = (elementProps: Record<string, unknown>): string | undefined => {
  const type = elementProps['data-component-type']
  return typeof type === 'string' && type.length > 0 ? type : undefined
}

/**
 * The host's class: the classes the host draws itself (its shell chrome, when
 * it has any) followed by the author's `props.className`. `undefined` when both
 * are empty, so a host with neither writes no `class` attribute at all.
 */
export const hostClassName = (
  elementProps: Record<string, unknown>,
  own?: string
): string | undefined => {
  const authored = elementProps['className']
  const tokens = [own, typeof authored === 'string' ? authored : undefined].filter(
    (token): token is string => token !== undefined && token.trim().length > 0
  )
  return tokens.length === 0 ? undefined : tokens.join(' ')
}
